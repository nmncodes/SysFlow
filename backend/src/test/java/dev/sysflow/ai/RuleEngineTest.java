package dev.sysflow.ai;

import dev.sysflow.ai.dto.Finding;
import dev.sysflow.simulation.model.GraphEdge;
import dev.sysflow.simulation.model.GraphNode;
import dev.sysflow.simulation.model.SimulationGraph;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RuleEngineTest {

    private final RuleEngine engine = new RuleEngine();

    @Test
    void flagsUnreplicatedDatabaseAsSpof() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("svc", "service", Map.of()),
                        new GraphNode("db", "database", Map.of("replicaCount", 0.0))
                ),
                List.of(new GraphEdge("e1", "svc", "db"))
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().anyMatch(f -> f.severity().equals("critical") && f.affectedNodeIds().contains("db")));
    }

    @Test
    void doesNotFlagReplicatedDatabase() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("svc", "service", Map.of()),
                        new GraphNode("db", "database", Map.of("replicaCount", 2.0)),
                        new GraphNode("cache", "cache", Map.of())
                ),
                List.of(new GraphEdge("e1", "svc", "db"))
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().noneMatch(f -> f.affectedNodeIds().contains("db")));
    }

    @Test
    void flagsMissingCacheInFrontOfDatabase() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("svc", "service", Map.of()),
                        new GraphNode("db", "database", Map.of("replicaCount", 1.0))
                ),
                List.of(new GraphEdge("e1", "svc", "db"))
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().anyMatch(f -> f.title().toLowerCase().contains("cache")));
    }

    @Test
    void flagsDirectClientToDatabaseConnection() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("db", "database", Map.of("replicaCount", 1.0))
                ),
                List.of(new GraphEdge("e1", "client", "db"))
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().anyMatch(f -> f.severity().equals("critical") && f.title().toLowerCase().contains("directly")));
    }

    @Test
    void flagsMultipleServicesWithNoLoadBalancer() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("svc1", "service", Map.of()),
                        new GraphNode("svc2", "service", Map.of())
                ),
                List.of(new GraphEdge("e1", "client", "svc1"), new GraphEdge("e2", "client", "svc2"))
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().anyMatch(f -> f.title().toLowerCase().contains("load balancer")));
    }

    @Test
    void healthyGraphWithCacheAndLoadBalancerHasNoCriticalFindings() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("lb", "loadBalancer", Map.of()),
                        new GraphNode("gw", "apiGateway", Map.of()),
                        new GraphNode("svc1", "service", Map.of()),
                        new GraphNode("svc2", "service", Map.of()),
                        new GraphNode("cache", "cache", Map.of()),
                        new GraphNode("db", "database", Map.of("replicaCount", 2.0))
                ),
                List.of(
                        new GraphEdge("e1", "client", "gw"),
                        new GraphEdge("e2", "gw", "lb"),
                        new GraphEdge("e3", "lb", "svc1"),
                        new GraphEdge("e4", "lb", "svc2"),
                        new GraphEdge("e5", "svc1", "cache"),
                        new GraphEdge("e6", "svc2", "cache"),
                        new GraphEdge("e7", "cache", "db")
                )
        );

        List<Finding> findings = engine.analyze(graph);

        assertTrue(findings.stream().noneMatch(f -> f.severity().equals("critical")));
    }
}
