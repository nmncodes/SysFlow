package dev.sysflow.simulation;

import dev.sysflow.simulation.model.*;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Tick-based, probabilistic simulation engine.
 *
 * This is intentionally NOT a discrete-event / queueing-theory accurate
 * network simulator. Per docs/02-ARCHITECTURE.md §4, it's a simplified
 * analytical model: on each tick, request flow is propagated in
 * topological order from Client nodes downward, latency is sampled per
 * node from its configured distribution, and nodes over capacity fail
 * the excess. This is tractable, deterministic given a seed, and good
 * enough to teach the tradeoffs the product cares about (bottlenecks,
 * SPOFs, cascading failure) without modeling real TCP/OS behavior.
 */
@Component
public class SimulationEngine {

    public SimulationResult run(SimulationGraph graph, SimulationConfig config) {
        List<GraphNode> topoOrder = graph.topologicalOrder();
        List<Tick> ticks = new ArrayList<>(config.totalTicks());
        Random random = new Random(config.randomSeed());

        double sumRps = 0, sumErrorRate = 0, sumP95 = 0;
        Map<String, Double> maxLoadByNode = new HashMap<>();
        Map<String, Integer> asgReplicas = new HashMap<>();

        for (int t = 0; t < config.totalTicks(); t++) {
            Map<String, InjectedFailure> activeNodeFailures = activeFailuresByNode(config, t);
            Map<String, InjectedFailure> activeEdgeFailures = activeFailuresByEdge(config, t);

            Map<String, Double> incomingRate = new HashMap<>();
            Map<String, Double> incomingFailedRate = new HashMap<>();
            Map<String, NodeTickStats> nodeStats = new LinkedHashMap<>();
            Map<String, EdgeTickStats> edgeStats = new LinkedHashMap<>();

            double perClientArrival = (config.targetRps() / SimulationConfig.TICKS_PER_SECOND)
                    / Math.max(1, graph.clientNodes().size());
            for (GraphNode client : graph.clientNodes()) {
                incomingRate.merge(client.id(), perClientArrival, Double::sum);
            }

            double totalAttempted = 0;
            double totalFailed = 0;
            double totalLatencyWeighted = 0;
            double totalSucceeded = 0;

            for (GraphNode node : topoOrder) {
                double arriving = incomingRate.getOrDefault(node.id(), 0.0);
                double arrivingFailed = incomingFailedRate.getOrDefault(node.id(), 0.0);
                boolean isClient = "client".equals(node.type());

                InjectedFailure killOrDegrade = activeNodeFailures.get(node.id());
                boolean killed = killOrDegrade != null && "kill".equals(killOrDegrade.type());

                int replicas = 1;
                if ("autoScalingGroup".equals(node.type())) {
                    replicas = asgReplicas.getOrDefault(node.id(), (int) node.getNumber("minReplicas", 1));
                }

                double baseCapacity = capacityOf(node);
                double capacity = "autoScalingGroup".equals(node.type()) ? baseCapacity * replicas : baseCapacity;
                double effectiveCapacity = killOrDegrade != null && "throttle".equals(killOrDegrade.type())
                        ? capacity * (1 - clampPct(killOrDegrade.throttlePct()))
                        : capacity;

                double accepted;
                double failedHere;
                if (killed) {
                    accepted = 0;
                    failedHere = arriving;
                } else if (isClient) {
                    accepted = arriving;
                    failedHere = arrivingFailed;
                } else if (arriving <= effectiveCapacity) {
                    accepted = arriving;
                    failedHere = arrivingFailed;
                } else {
                    accepted = effectiveCapacity;
                    failedHere = arrivingFailed + (arriving - effectiveCapacity);
                }

                double baseLatency = isClient ? 0 : latencyOf(node, random);
                double extraLatency = killOrDegrade != null && "latency".equals(killOrDegrade.type())
                        ? killOrDegrade.extraMs()
                        : 0;
                double nodeLatency = baseLatency + extraLatency;

                double loadPct = effectiveCapacity <= 0 ? (arriving > 0 ? 200 : 0)
                        : Math.min(200, (arriving / effectiveCapacity) * 100);
                double totalIn = arriving + arrivingFailed;
                double errorRatePct = totalIn <= 0 ? 0 : Math.min(100, (failedHere / totalIn) * 100);

                nodeStats.put(node.id(), new NodeTickStats(round2(loadPct), round2(errorRatePct), round2(nodeLatency), killed, replicas));

                if ("autoScalingGroup".equals(node.type())) {
                    double targetLoad = node.getNumber("targetLoadPct", 70);
                    int maxReplicas = (int) node.getNumber("maxReplicas", 10);
                    int minReplicas = (int) node.getNumber("minReplicas", 1);
                    if (loadPct > targetLoad && replicas < maxReplicas) {
                        asgReplicas.put(node.id(), replicas + 1);
                    } else if (loadPct < (targetLoad - 20) && replicas > minReplicas) {
                        asgReplicas.put(node.id(), replicas - 1);
                    } else {
                        asgReplicas.put(node.id(), replicas);
                    }
                }

                if (graph.outgoing(node.id()).isEmpty() && !isClient) {
                    totalAttempted += arriving + arrivingFailed;
                    totalFailed += failedHere;
                    totalSucceeded += accepted;
                    totalLatencyWeighted += accepted * nodeLatency;
                }

                maxLoadByNode.merge(node.id(), loadPct, Math::max);

                List<GraphEdge> outEdges = graph.outgoing(node.id());
                if (!outEdges.isEmpty()) {
                    double sharePerEdge = accepted / outEdges.size();
                    double failedSharePerEdge = failedHere / Math.max(1, outEdges.size());
                    for (GraphEdge edge : outEdges) {
                        InjectedFailure edgeFailure = activeEdgeFailures.get(edge.id());
                        double dropPct = edgeFailure != null ? clampPct(edgeFailure.dropPct()) : 0;
                        double dropped = sharePerEdge * dropPct;
                        double forwarded = sharePerEdge - dropped;

                        incomingRate.merge(edge.target(), forwarded, Double::sum);
                        incomingFailedRate.merge(edge.target(), failedSharePerEdge + dropped, Double::sum);

                        edgeStats.put(edge.id(), new EdgeTickStats(round2(forwarded), round2(nodeLatency)));
                    }
                } else if (!isClient) {
                    // terminal node — nothing to forward
                }
            }

            double tickRps = totalSucceeded * SimulationConfig.TICKS_PER_SECOND;
            double tickErrorRate = totalAttempted <= 0 ? 0 : (totalFailed / totalAttempted) * 100;
            double p50 = totalSucceeded <= 0 ? 0 : totalLatencyWeighted / totalSucceeded;
            double p95 = p50 * 1.5;
            double p99 = p50 * 2.2;

            sumRps += tickRps;
            sumErrorRate += tickErrorRate;
            sumP95 += p95;

            ticks.add(new Tick(t, nodeStats, edgeStats,
                    new GlobalTickStats(round2(tickRps), round2(tickErrorRate), round2(p50), round2(p95), round2(p99))));
        }

        int n = Math.max(1, ticks.size());
        String bottleneckId = maxLoadByNode.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        double bottleneckLoad = bottleneckId == null ? 0 : maxLoadByNode.get(bottleneckId);

        List<String> spofs = graph.nodes().stream()
                .filter(node -> !"client".equals(node.type()))
                .filter(node -> graph.incoming(node.id()).size() >= 1)
                .filter(node -> isUnreplicated(node))
                .filter(node -> hasMultipleDependents(graph, node))
                .map(GraphNode::id)
                .toList();

        SimulationSummary summary = new SimulationSummary(
                round2(sumRps / n), round2(sumErrorRate / n), round2(sumP95 / n),
                bottleneckId, round2(bottleneckLoad), spofs
        );

        return new SimulationResult(ticks, summary);
    }

    private boolean isUnreplicated(GraphNode node) {
        if ("database".equals(node.type()) || "searchIndex".equals(node.type())) {
            return node.getNumber("replicaCount", 0) <= 0;
        }
        return "service".equals(node.type()) || "cache".equals(node.type()) || "queue".equals(node.type())
                || "messageBroker".equals(node.type()) || "dataWarehouse".equals(node.type());
    }

    private boolean hasMultipleDependents(SimulationGraph graph, GraphNode node) {
        // A node fed by a load balancer/gateway (i.e. has upstream fan-in) is presumed
        // to be the sole handler for that traffic — flag it unless it's explicitly replicated.
        return !graph.incoming(node.id()).isEmpty();
    }

    private Map<String, InjectedFailure> activeFailuresByNode(SimulationConfig config, int tick) {
        Map<String, InjectedFailure> map = new HashMap<>();
        for (InjectedFailure f : config.injectedFailures()) {
            if (f.nodeId() != null && f.activeAt(tick)) map.put(f.nodeId(), f);
        }
        return map;
    }

    private Map<String, InjectedFailure> activeFailuresByEdge(SimulationConfig config, int tick) {
        Map<String, InjectedFailure> map = new HashMap<>();
        for (InjectedFailure f : config.injectedFailures()) {
            if (f.edgeId() != null && f.activeAt(tick)) map.put(f.edgeId(), f);
        }
        return map;
    }

    private double capacityOf(GraphNode node) {
        return switch (node.type()) {
            case "client", "mobile", "webBrowser", "iotDevice" -> Double.MAX_VALUE;
            case "dns" -> Double.MAX_VALUE;
            case "cdn" -> node.getNumber("maxThroughput", 5000);
            case "loadBalancer" -> node.getNumber("maxThroughput", 1000);
            case "apiGateway" -> node.getNumber("rateLimit", 500);
            case "waf" -> node.getNumber("maxThroughput", 2000);
            case "ingress" -> node.getNumber("maxThroughput", 1500);
            case "service" -> node.getNumber("maxConcurrency", 500);
            case "worker" -> node.getNumber("maxConcurrency", 300);
            case "serverless" -> node.getNumber("maxConcurrency", 1000);
            case "autoScalingGroup", "containerOrchestrator" -> node.getNumber("baseCapacityPerReplica", 500);
            case "cronJob" -> node.getNumber("maxConcurrency", 50);
            case "cache" -> Double.MAX_VALUE;
            case "database" -> node.getNumber("maxConnections", 200);
            case "dataWarehouse" -> node.getNumber("maxConnections", 100);
            case "queue" -> node.getNumber("maxThroughput", 1000);
            case "objectStorage" -> node.getNumber("maxThroughput", 3000);
            case "searchIndex" -> node.getNumber("maxConnections", 300);
            case "dataLake" -> node.getNumber("maxConnections", 100);
            case "messageBroker" -> node.getNumber("maxThroughput", 2000);
            case "eventBus" -> node.getNumber("maxThroughput", 3000);
            case "webhook" -> node.getNumber("maxThroughput", 300);
            case "monitoring", "logging" -> node.getNumber("maxThroughput", 5000);
            case "thirdPartyApi" -> node.getNumber("maxThroughput", 200);
            case "paymentGateway" -> node.getNumber("maxThroughput", 150);
            default -> 1000;
        };
    }

    private double latencyOf(GraphNode node, Random random) {
        return switch (node.type()) {
            case "dns" -> node.getNumber("resolutionLatencyMs", 5);
            case "cdn" -> {
                double hitRate = clampPct(node.getNumber("hitRatePct", 90) / 100.0);
                double hitLatency = node.getNumber("hitLatencyMs", 3);
                double missLatency = node.getNumber("missLatencyMs", 35);
                yield random.nextDouble() < hitRate ? hitLatency : missLatency;
            }
            case "loadBalancer" -> 1 + random.nextDouble() * 2;
            case "apiGateway" -> 2 + random.nextDouble() * 3;
            case "waf" -> node.getNumber("extraLatencyMs", 2) + random.nextDouble() * 2;
            case "ingress" -> 1 + random.nextDouble() * 2;
            case "service", "worker", "serverless", "autoScalingGroup", "containerOrchestrator", "cronJob" -> {
                double min = node.getNumber("minLatencyMs", 20);
                double max = node.getNumber("maxLatencyMs", 80);
                yield min + random.nextDouble() * Math.max(0, max - min);
            }
            case "cache" -> {
                double hitRate = clampPct(node.getNumber("hitRatePct", 80) / 100.0);
                double hitLatency = node.getNumber("hitLatencyMs", 2);
                double missLatency = node.getNumber("missLatencyMs", 40);
                yield random.nextDouble() < hitRate ? hitLatency : missLatency;
            }
            case "database" -> node.getNumber("readLatencyMs", 15) + random.nextDouble() * 5;
            case "dataWarehouse" -> node.getNumber("readLatencyMs", 60) + random.nextDouble() * 15;
            case "objectStorage" -> node.getNumber("readLatencyMs", 25) + random.nextDouble() * 10;
            case "searchIndex" -> node.getNumber("readLatencyMs", 20) + random.nextDouble() * 8;
            case "dataLake" -> node.getNumber("readLatencyMs", 80) + random.nextDouble() * 20;
            case "queue", "messageBroker" -> 5 + random.nextDouble() * 10;
            case "eventBus" -> 2 + random.nextDouble() * 5;
            case "webhook" -> node.getNumber("extraLatencyMs", 20) + random.nextDouble() * 30;
            case "monitoring", "logging" -> 1 + random.nextDouble() * 2;
            case "thirdPartyApi" -> node.getNumber("minLatencyMs", 50) + random.nextDouble() * Math.max(0, node.getNumber("maxLatencyMs", 400) - node.getNumber("minLatencyMs", 50));
            case "paymentGateway" -> node.getNumber("minLatencyMs", 100) + random.nextDouble() * Math.max(0, node.getNumber("maxLatencyMs", 600) - node.getNumber("minLatencyMs", 100));
            default -> 5;
        };
    }

    private double clampPct(double v) {
        return Math.max(0, Math.min(1, v > 1 ? v / 100.0 : v));
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
