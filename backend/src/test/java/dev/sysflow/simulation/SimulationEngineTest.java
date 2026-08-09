package dev.sysflow.simulation;

import dev.sysflow.simulation.model.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SimulationEngineTest {

    private final SimulationEngine engine = new SimulationEngine();

    /** Client -> LB -> Service -> DB, all within capacity: should be healthy, no errors. */
    @Test
    void healthyThreeTierProducesNoErrors() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("lb", "loadBalancer", Map.of("maxThroughput", 1000.0)),
                        new GraphNode("svc", "service", Map.of("minLatencyMs", 20.0, "maxLatencyMs", 40.0, "maxConcurrency", 500.0)),
                        new GraphNode("db", "database", Map.of("readLatencyMs", 10.0, "maxConnections", 500.0, "replicaCount", 1.0))
                ),
                List.of(
                        new GraphEdge("e1", "client", "lb"),
                        new GraphEdge("e2", "lb", "svc"),
                        new GraphEdge("e3", "svc", "db")
                )
        );
        SimulationConfig config = new SimulationConfig(100, 2, List.of(), 1L);

        SimulationResult result = engine.run(graph, config);

        assertEquals(20, result.ticks().size());
        assertTrue(result.summary().avgErrorRatePct() < 1.0, "expected near-zero error rate under capacity");
        assertTrue(result.summary().avgRps() > 0);
    }

    /** Client -> Service -> DB with no replica: DB should be flagged as a single point of failure. */
    @Test
    void unreplicatedDatabaseIsFlaggedAsSpof() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("svc", "service", Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0, "maxConcurrency", 500.0)),
                        new GraphNode("db", "database", Map.of("readLatencyMs", 10.0, "maxConnections", 500.0, "replicaCount", 0.0))
                ),
                List.of(
                        new GraphEdge("e1", "client", "svc"),
                        new GraphEdge("e2", "svc", "db")
                )
        );
        SimulationConfig config = new SimulationConfig(50, 1, List.of(), 1L);

        SimulationResult result = engine.run(graph, config);

        assertTrue(result.summary().singlePointsOfFailure().contains("db"));
    }

    /** Service capacity far below arrival rate: should show high load and non-zero error rate. */
    @Test
    void saturatedServiceProducesErrorsAndHighLoad() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("svc", "service", Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0, "maxConcurrency", 5.0))
                ),
                List.of(new GraphEdge("e1", "client", "svc"))
        );
        SimulationConfig config = new SimulationConfig(1000, 1, List.of(), 1L);

        SimulationResult result = engine.run(graph, config);

        assertTrue(result.summary().avgErrorRatePct() > 50, "expected heavy overload to cause majority errors");
        assertEquals("svc", result.summary().bottleneckNodeId());
        assertTrue(result.summary().bottleneckLoadPct() >= 100);
    }

    /** Killing a node mid-simulation should show it "down" and cause downstream failures. */
    @Test
    void killedNodeShowsDownAndBlocksDownstream() {
        SimulationGraph graph = new SimulationGraph(
                List.of(
                        new GraphNode("client", "client", Map.of()),
                        new GraphNode("svc", "service", Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0, "maxConcurrency", 500.0)),
                        new GraphNode("db", "database", Map.of("readLatencyMs", 10.0, "maxConnections", 500.0))
                ),
                List.of(
                        new GraphEdge("e1", "client", "svc"),
                        new GraphEdge("e2", "svc", "db")
                )
        );
        InjectedFailure kill = new InjectedFailure("kill", "svc", null, 0, null, 0, 0, 0);
        SimulationConfig config = new SimulationConfig(100, 1, List.of(kill), 1L);

        SimulationResult result = engine.run(graph, config);

        Tick lastTick = result.ticks().get(result.ticks().size() - 1);
        assertTrue(lastTick.nodes().get("svc").down());
        assertEquals(0.0, lastTick.edges().get("e2").inFlight());
    }
}
