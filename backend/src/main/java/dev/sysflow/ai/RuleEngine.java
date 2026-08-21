package dev.sysflow.ai;

import dev.sysflow.ai.dto.Finding;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Deterministic static analysis over the graph structure — the "facts"
 * stage of the two-stage AI pipeline described in
 * docs/02-ARCHITECTURE.md §5. Runs with no external dependency and no
 * simulation required, so it always produces something useful even
 * before the LLM synthesis stage is available.
 */
@Component
public class RuleEngine {

    // Types with an explicit replicaCount config — flagged as a SPOF only when that count is 0.
    // Caches/queues/brokers are deliberately excluded: running unreplicated is common for them
    // and isn't inherently a SPOF the way an unreplicated database is.
    private static final Set<String> REPLICATED_DATA_STORES = Set.of("database", "searchIndex");
    private static final Set<String> DATA_STORE_TYPES = Set.of(
            "database", "dataWarehouse", "searchIndex", "dataLake", "objectStorage", "messageBroker");
    private static final Set<String> CLIENT_TYPES = Set.of("client", "mobile", "webBrowser", "iotDevice");
    private static final Set<String> COMPUTE_TYPES = Set.of("service", "worker", "containerOrchestrator");

    public List<Finding> analyze(SimulationGraph graph) {
        List<Finding> findings = new ArrayList<>();
        findings.addAll(findUnreplicatedDataStores(graph));
        findings.addAll(findMissingCache(graph));
        findings.addAll(findDirectClientToDataStore(graph));
        findings.addAll(findMissingGateway(graph));
        findings.addAll(findMissingLoadBalancer(graph));
        findings.addAll(findExposedPaymentGateway(graph));
        findings.addAll(findNoObservability(graph));
        findings.addAll(findObjectStorageWithoutCdn(graph));
        findings.addAll(findCronJobWithMultipleDirectWrites(graph));
        findings.addAll(findUnbufferedWebhook(graph));
        return findings;
    }

    private List<Finding> findUnreplicatedDataStores(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            if (!REPLICATED_DATA_STORES.contains(node.type()) || graph.incoming(node.id()).isEmpty()) continue;

            double replicas = node.getNumber("replicaCount", 0);
            if (replicas > 0) continue;

            out.add(new Finding(
                    "critical",
                    "Single point of failure: " + node.type(),
                    List.of(node.id()),
                    "\"" + node.id() + "\" has no replica or failover. If it goes down, every upstream component depending on it fails with it.",
                    "Add at least one replica, or a failover instance, for this component."
            ));
        }
        return out;
    }

    private List<Finding> findMissingCache(SimulationGraph graph) {
        boolean hasDatabase = graph.nodes().stream().anyMatch(n -> "database".equals(n.type()));
        boolean hasCache = graph.nodes().stream().anyMatch(n -> "cache".equals(n.type()));
        if (!hasDatabase || hasCache) return List.of();

        List<String> dbIds = graph.nodes().stream().filter(n -> "database".equals(n.type())).map(GraphNode::id).toList();
        return List.of(new Finding(
                "warning",
                "No cache in front of the database",
                dbIds,
                "Every read hits the database directly. Under load this is usually the first thing to saturate.",
                "Add a Cache component between your service layer and the database for frequently-read data."
        ));
    }

    private List<Finding> findDirectClientToDataStore(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphEdge edge : allEdges(graph)) {
            GraphNode source = graph.node(edge.source());
            GraphNode target = graph.node(edge.target());
            if (source == null || target == null) continue;
            if (CLIENT_TYPES.contains(source.type()) && DATA_STORE_TYPES.contains(target.type())) {
                out.add(new Finding(
                        "critical",
                        "Client connects directly to a data store",
                        List.of(source.id(), target.id()),
                        "\"" + source.id() + "\" bypasses the service layer entirely, so there's no place to enforce business logic, auth, or rate limiting before a query hits \"" + target.id() + "\".",
                        "Route this traffic through a Service (or API Gateway) instead of hitting the data store directly."
                ));
            }
        }
        return out;
    }

    private List<Finding> findMissingGateway(SimulationGraph graph) {
        boolean hasCompute = graph.nodes().stream().anyMatch(n -> COMPUTE_TYPES.contains(n.type()));
        boolean hasGateway = graph.nodes().stream().anyMatch(n -> "apiGateway".equals(n.type()));
        if (!hasCompute || hasGateway) return List.of();

        return List.of(new Finding(
                "info",
                "No API Gateway or rate limiting layer",
                List.of(),
                "There's nothing in this design that rate-limits or authenticates incoming requests before they reach a service.",
                "Consider adding an API Gateway in front of your services for rate limiting and centralized auth."
        ));
    }

    private List<Finding> findMissingLoadBalancer(SimulationGraph graph) {
        long computeCount = graph.nodes().stream().filter(n -> COMPUTE_TYPES.contains(n.type())).count();
        boolean hasLoadBalancer = graph.nodes().stream().anyMatch(n -> "loadBalancer".equals(n.type()));
        if (computeCount <= 1 || hasLoadBalancer) return List.of();

        List<String> computeIds = graph.nodes().stream().filter(n -> COMPUTE_TYPES.contains(n.type())).map(GraphNode::id).toList();
        return List.of(new Finding(
                "warning",
                "Multiple compute instances with no load balancer",
                computeIds,
                "Traffic has no defined path for distributing load across these instances.",
                "Add a Load Balancer in front of these components to distribute traffic and support horizontal scaling."
        ));
    }

    private List<Finding> findExposedPaymentGateway(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            if (!"paymentGateway".equals(node.type())) continue;
            boolean directlyExposed = graph.incoming(node.id()).stream()
                    .map(GraphEdge::source)
                    .map(graph::node)
                    .anyMatch(source -> source != null && CLIENT_TYPES.contains(source.type()));
            if (!directlyExposed) continue;

            out.add(new Finding(
                    "critical",
                    "Payment Gateway is directly reachable from a client",
                    List.of(node.id()),
                    "\"" + node.id() + "\" accepts traffic straight from a client with nothing enforcing auth, validation, or rate limiting in front of it.",
                    "Put a Service (and ideally a WAF/API Gateway) between the client and the Payment Gateway — never call payment providers directly from client code."
            ));
        }
        return out;
    }

    private List<Finding> findNoObservability(SimulationGraph graph) {
        long meaningfulNodes = graph.nodes().stream()
                .filter(n -> !CLIENT_TYPES.contains(n.type()))
                .count();
        boolean hasObservability = graph.nodes().stream()
                .anyMatch(n -> "monitoring".equals(n.type()) || "logging".equals(n.type()));
        if (meaningfulNodes < 4 || hasObservability) return List.of();

        return List.of(new Finding(
                "info",
                "No monitoring or logging in this design",
                List.of(),
                "A design this size has no visibility into request failures, latency, or errors once it's running.",
                "Add a Monitoring and/or Logging component so failures surface before users report them."
        ));
    }

    private List<Finding> findObjectStorageWithoutCdn(SimulationGraph graph) {
        boolean hasUsedObjectStorage = graph.nodes().stream()
                .anyMatch(n -> "objectStorage".equals(n.type()) && !graph.incoming(n.id()).isEmpty());
        boolean hasCdn = graph.nodes().stream().anyMatch(n -> "cdn".equals(n.type()));
        if (!hasUsedObjectStorage || hasCdn) return List.of();

        List<String> storageIds = graph.nodes().stream()
                .filter(n -> "objectStorage".equals(n.type()))
                .map(GraphNode::id)
                .toList();
        return List.of(new Finding(
                "info",
                "Object storage with no CDN in front of it",
                storageIds,
                "Every request for a stored object round-trips all the way to object storage — no edge caching for static assets like images, videos, or downloads.",
                "Put a CDN in front of your object storage to cut latency and egress cost for frequently-requested objects."
        ));
    }

    private List<Finding> findCronJobWithMultipleDirectWrites(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            if (!"cronJob".equals(node.type())) continue;

            List<String> directStoreTargets = graph.outgoing(node.id()).stream()
                    .map(GraphEdge::target)
                    .map(graph::node)
                    .filter(target -> target != null && DATA_STORE_TYPES.contains(target.type()))
                    .map(GraphNode::id)
                    .toList();
            if (directStoreTargets.size() < 2) continue;

            out.add(new Finding(
                    "warning",
                    "Cron job writes directly to multiple data stores",
                    directStoreTargets,
                    "\"" + node.id() + "\" writes to " + directStoreTargets.size() + " data stores directly. If a scheduled run fails partway through, some stores get updated and others don't, and cron retries typically re-run the whole job rather than resuming from where it failed.",
                    "Make the writes idempotent, or route them through a queue so a retry doesn't double-apply the writes that already succeeded."
            ));
        }
        return out;
    }

    private List<Finding> findUnbufferedWebhook(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            if (!"webhook".equals(node.type())) continue;

            List<String> unbufferedTargets = graph.outgoing(node.id()).stream()
                    .map(GraphEdge::target)
                    .map(graph::node)
                    .filter(target -> target != null && COMPUTE_TYPES.contains(target.type()))
                    .map(GraphNode::id)
                    .toList();
            if (unbufferedTargets.isEmpty()) continue;

            out.add(new Finding(
                    "warning",
                    "Webhook has no buffer before its consumer",
                    unbufferedTargets,
                    "\"" + node.id() + "\" delivers directly into " + String.join(", ", unbufferedTargets) + " with nothing to absorb a burst or a slow/unavailable consumer. Incoming webhook deliveries can arrive faster than you can process them, and most providers only retry a handful of times before giving up.",
                    "Put a queue or message broker between the webhook receiver and its consumer so bursts and slow processing don't drop deliveries."
            ));
        }
        return out;
    }

    private List<GraphEdge> allEdges(SimulationGraph graph) {
        List<GraphEdge> edges = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            edges.addAll(graph.outgoing(node.id()));
        }
        return edges;
    }
}
