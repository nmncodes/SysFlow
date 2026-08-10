package dev.sysflow.ai;

import dev.sysflow.ai.dto.Finding;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic static analysis over the graph structure — the "facts"
 * stage of the two-stage AI pipeline described in
 * docs/02-ARCHITECTURE.md §5. Runs with no external dependency and no
 * simulation required, so it always produces something useful even
 * before the LLM synthesis stage is available.
 */
@Component
public class RuleEngine {

    public List<Finding> analyze(SimulationGraph graph) {
        List<Finding> findings = new ArrayList<>();
        findings.addAll(findUnreplicatedDataStores(graph));
        findings.addAll(findMissingCache(graph));
        findings.addAll(findDirectClientToDatabase(graph));
        findings.addAll(findMissingGateway(graph));
        findings.addAll(findMissingLoadBalancer(graph));
        return findings;
    }

    private List<Finding> findUnreplicatedDataStores(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            // Restricted to databases: caches/queues without an explicit replica count
            // are common and not inherently a SPOF the way an unreplicated DB is.
            if (!"database".equals(node.type()) || graph.incoming(node.id()).isEmpty()) continue;

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

    private List<Finding> findDirectClientToDatabase(SimulationGraph graph) {
        List<Finding> out = new ArrayList<>();
        for (GraphEdge edge : allEdges(graph)) {
            GraphNode source = graph.node(edge.source());
            GraphNode target = graph.node(edge.target());
            if (source == null || target == null) continue;
            if ("client".equals(source.type()) && "database".equals(target.type())) {
                out.add(new Finding(
                        "critical",
                        "Client connects directly to the database",
                        List.of(source.id(), target.id()),
                        "\"" + source.id() + "\" bypasses the service layer entirely, so there's no place to enforce business logic, auth, or rate limiting before a query hits the database.",
                        "Route this traffic through a Service (or API Gateway) instead of hitting the database directly."
                ));
            }
        }
        return out;
    }

    private List<Finding> findMissingGateway(SimulationGraph graph) {
        boolean hasService = graph.nodes().stream().anyMatch(n -> "service".equals(n.type()));
        boolean hasGateway = graph.nodes().stream().anyMatch(n -> "apiGateway".equals(n.type()));
        if (!hasService || hasGateway) return List.of();

        return List.of(new Finding(
                "info",
                "No API Gateway or rate limiting layer",
                List.of(),
                "There's nothing in this design that rate-limits or authenticates incoming requests before they reach a service.",
                "Consider adding an API Gateway in front of your services for rate limiting and centralized auth."
        ));
    }

    private List<Finding> findMissingLoadBalancer(SimulationGraph graph) {
        long serviceCount = graph.nodes().stream().filter(n -> "service".equals(n.type())).count();
        boolean hasLoadBalancer = graph.nodes().stream().anyMatch(n -> "loadBalancer".equals(n.type()));
        if (serviceCount <= 1 || hasLoadBalancer) return List.of();

        List<String> serviceIds = graph.nodes().stream().filter(n -> "service".equals(n.type())).map(GraphNode::id).toList();
        return List.of(new Finding(
                "warning",
                "Multiple services with no load balancer",
                serviceIds,
                "Traffic has no defined path for distributing load across these service instances.",
                "Add a Load Balancer in front of these services to distribute traffic and support horizontal scaling."
        ));
    }

    private List<GraphEdge> allEdges(SimulationGraph graph) {
        List<GraphEdge> edges = new ArrayList<>();
        for (GraphNode node : graph.nodes()) {
            edges.addAll(graph.outgoing(node.id()));
        }
        return edges;
    }
}
