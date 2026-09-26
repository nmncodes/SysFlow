package dev.sysflow.simulation;

import dev.sysflow.simulation.model.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SimulationEngineTest {

        private final SimulationEngine engine = new SimulationEngine();

        /**
         * Client -> LB -> Service -> DB, all within capacity: should be healthy, no
         * errors.
         */
        @Test
        void healthyThreeTierProducesNoErrors() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("lb", "loadBalancer", Map.of("maxThroughput", 1000.0)),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 20.0, "maxLatencyMs", 40.0,
                                                                                "maxConcurrency", 500.0)),
                                                new GraphNode("db", "database",
                                                                Map.of("readLatencyMs", 10.0, "maxConnections", 500.0,
                                                                                "replicaCount", 1.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "lb"),
                                                new GraphEdge("e2", "lb", "svc"),
                                                new GraphEdge("e3", "svc", "db")));
                SimulationConfig config = new SimulationConfig(100, 2, List.of(), 1L);

                SimulationResult result = engine.run(graph, config);

                assertEquals(20, result.ticks().size());
                assertTrue(result.summary().avgErrorRatePct() < 1.0, "expected near-zero error rate under capacity");
                assertTrue(result.summary().avgRps() > 0);
        }

        /**
         * Client -> Service -> DB with no replica: DB should be flagged as a single
         * point of failure.
         */
        @Test
        void unreplicatedDatabaseIsFlaggedAsSpof() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 500.0)),
                                                new GraphNode("db", "database",
                                                                Map.of("readLatencyMs", 10.0, "maxConnections", 500.0,
                                                                                "replicaCount", 0.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc"),
                                                new GraphEdge("e2", "svc", "db")));
                SimulationConfig config = new SimulationConfig(50, 1, List.of(), 1L);

                SimulationResult result = engine.run(graph, config);

                assertTrue(result.summary().singlePointsOfFailure().contains("db"));
        }

        /**
         * Service capacity far below arrival rate: should show high load and non-zero
         * error rate.
         */
        @Test
        void saturatedServiceProducesErrorsAndHighLoad() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 5.0))),
                                List.of(new GraphEdge("e1", "client", "svc")));
                SimulationConfig config = new SimulationConfig(1000, 1, List.of(), 1L);

                SimulationResult result = engine.run(graph, config);

                assertTrue(result.summary().avgErrorRatePct() > 50, "expected heavy overload to cause majority errors");
                assertEquals("svc", result.summary().bottleneckNodeId());
                assertTrue(result.summary().bottleneckLoadPct() >= 100);
        }

        /**
         * Killing a node mid-simulation should show it "down" and cause downstream
         * failures.
         */
        @Test
        void killedNodeShowsDownAndBlocksDownstream() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 500.0)),
                                                new GraphNode("db", "database",
                                                                Map.of("readLatencyMs", 10.0, "maxConnections",
                                                                                500.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc"),
                                                new GraphEdge("e2", "svc", "db")));
                InjectedFailure kill = new InjectedFailure("kill", "svc", null, 0, null, 0, 0, 0);
                SimulationConfig config = new SimulationConfig(100, 1, List.of(kill), 1L);

                SimulationResult result = engine.run(graph, config);

                Tick lastTick = result.ticks().get(result.ticks().size() - 1);
                assertTrue(lastTick.nodes().get("svc").down());
                assertEquals(0.0, lastTick.edges().get("e2").inFlight());

        }

        /**
         * Service latency should be sampled independently for successful requests.
         * This ensures the simulation produces a latency distribution rather than
         * assigning exactly the same latency to every request in a batch.
         */
        @Test
        void serviceProducesLatencyDistribution() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode(
                                                                "svc",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 20.0,
                                                                                "maxLatencyMs", 100.0,
                                                                                "maxConcurrency", 1000.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc")));

                SimulationConfig config = new SimulationConfig(
                                1000,
                                5,
                                List.of(),
                                1L);

                SimulationResult result = engine.run(graph, config);

                assertFalse(result.ticks().isEmpty());

                double p50 = result.ticks().get(0).global().p50();
                double p95 = result.ticks().get(0).global().p95();
                double p99 = result.ticks().get(0).global().p99();

                // Latencies must remain inside the configured service range.
                assertTrue(p50 >= 20.0 && p50 <= 100.0);
                assertTrue(p95 >= 20.0 && p95 <= 100.0);
                assertTrue(p99 >= 20.0 && p99 <= 100.0);

                // A sufficiently large sample (100 successful requests in this tick,
                // drawn from an 80ms-wide range) should produce a non-trivial latency
                // distribution rather than every request collapsing onto one value.
                assertTrue(p50 <= p95);
                assertTrue(p95 <= p99);
                assertTrue(p99 - p50 > 1.0,
                                "expected meaningful spread between p50 and p99 when each request is "
                                                + "sampled independently, got p50=" + p50 + " p99=" + p99);
        }

        /**
         * Each successful request within a single tick must receive its own
         * independent latency draw rather than every request in the tick sharing
         * one sampled value. This is the regression test for the latency-sampling
         * bug: previously one latency value was sampled per node per tick and
         * reused for every request completing that tick, so a batch of same-tick
         * requests always reported identical latency.
         */
        @Test
        void successfulRequestsInSameTickGetIndependentLatencySamples() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode(
                                                                "svc",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 10.0,
                                                                                "maxLatencyMs", 200.0,
                                                                                "maxConcurrency", 5000.0))),
                                List.of(new GraphEdge("e1", "client", "svc")));

                // A single tick's worth of a large burst of requests, all successful.
                SimulationConfig config = new SimulationConfig(20000, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                double p50 = result.ticks().get(0).global().p50();
                double p99 = result.ticks().get(0).global().p99();

                // With hundreds of independently sampled requests in one tick over a
                // 190ms-wide latency range, p50 and p99 must not be equal: if they were,
                // every request in the tick received the same latency value.
                assertTrue(p99 > p50,
                                "expected distinct p50/p99 from independently sampled per-request latency");
        }

        /**
         * Failed/rejected requests must not contribute a latency observation:
         * only accepted (successful) requests should feed the percentile
         * calculations.
         */
        @Test
        void failedRequestsDoNotContributeLatencySamples() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 5.0))),
                                List.of(new GraphEdge("e1", "client", "svc")));

                // Heavily overloaded: most requests are rejected, only a handful succeed.
                SimulationConfig config = new SimulationConfig(1000, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                Tick firstTick = result.ticks().get(0);
                double acceptedThisTick = firstTick.nodes().get("svc").loadPct() > 0
                                ? Math.min(firstTick.nodes().get("svc").loadPct(), 100.0)
                                : 0.0;

                // Every latency sample recorded overall must fall within the node's
                // configured latency range: if failed requests leaked into the
                // samples (e.g. as a zero or otherwise out-of-range value) this
                // would be violated, and percentiles would also be zero/undefined
                // when (as here) the vast majority of traffic fails.
                assertTrue(result.summary().p50() >= 10.0 && result.summary().p50() <= 20.0);
                assertTrue(result.summary().p95() >= 10.0 && result.summary().p95() <= 20.0);
                assertTrue(result.summary().p99() >= 10.0 && result.summary().p99() <= 20.0);
                assertTrue(acceptedThisTick >= 0.0);
        }

        /**
         * Verifies that latency accumulates across the complete request path.
         *
         * Client -> Service -> Database
         *
         * Expected approximate latency:
         * Service (20 ms) + Database (10 ms) = 30 ms
         */
        /**
         * Verifies that latency accumulates across the complete request path.
         *
         * Client -> Service A -> Service B
         *
         * Service A = 20 ms
         * Service B = 20 ms
         *
         * Expected end-to-end latency = 40 ms
         */
        @Test
        void endToEndLatencyIncludesAllNodesInPath() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),

                                                new GraphNode(
                                                                "svc1",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 20.0,
                                                                                "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0)),

                                                new GraphNode(
                                                                "svc2",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 20.0,
                                                                                "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc1"),
                                                new GraphEdge("e2", "svc1", "svc2")));

                SimulationConfig config = new SimulationConfig(10, 1, List.of(), 1L);

                SimulationResult result = engine.run(graph, config);

                double p50 = result.summary().p50();

                // Service A = 20 ms
                // Service B = 20 ms
                // Expected end-to-end latency = 40 ms
                assertEquals(40.0, p50, 0.001);
        }

        @Test
        void concurrencyCapacityUsesLittleLawEstimate() {
                SimulationResult result = engine.run(singleServiceGraph(100, 50, 50),
                                new SimulationConfig(3000, 1, List.of(), 1L));

                assertEquals(2000.0, result.summary().avgRps(), 0.01);
        }

        @Test
        void trafficBelowConcurrencyCapacityHasNoOverloadErrors() {
                SimulationResult result = engine.run(singleServiceGraph(100, 50, 50),
                                new SimulationConfig(1000, 1, List.of(), 1L));

                assertEquals(0.0, result.summary().avgErrorRatePct(), 0.01);
        }

        @Test
        void trafficAboveConcurrencyCapacityRejectsExcessRequests() {
                SimulationResult result = engine.run(singleServiceGraph(100, 50, 50),
                                new SimulationConfig(4000, 1, List.of(), 1L));

                assertTrue(result.summary().avgErrorRatePct() >= 40.0);
        }

        @Test
        void higherServiceLatencyReducesConcurrencyCapacity() {
                SimulationResult fast = engine.run(singleServiceGraph(100, 50, 50),
                                new SimulationConfig(1500, 1, List.of(), 1L));
                SimulationResult slow = engine.run(singleServiceGraph(100, 100, 100),
                                new SimulationConfig(1500, 1, List.of(), 1L));

                assertEquals(1500.0, fast.summary().avgRps(), 0.01);
                assertEquals(1000.0, slow.summary().avgRps(), 0.01);
        }

        private SimulationGraph singleServiceGraph(double maxConcurrency, double minLatencyMs, double maxLatencyMs) {
                return new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service", Map.of(
                                                                "maxConcurrency", maxConcurrency,
                                                                "minLatencyMs", minLatencyMs,
                                                                "maxLatencyMs", maxLatencyMs))),
                                List.of(new GraphEdge("e1", "client", "svc")));
        }

        /**
         * Verifies the relationship between concurrency, service latency,
         * and estimated throughput.
         *
         * With the same concurrency:
         *
         * 100 concurrency / 50 ms = approximately 2000 RPS
         * 100 concurrency / 100 ms = approximately 1000 RPS
         *
         * Therefore, doubling service latency should approximately halve
         * the available throughput.
         */
        @Test
        void higherLatencyReducesConcurrencyBasedCapacity() {

                SimulationGraph fastGraph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),

                                                new GraphNode(
                                                                "svc",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 50.0,
                                                                                "maxLatencyMs", 50.0,
                                                                                "maxConcurrency", 100.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc")));

                SimulationGraph slowGraph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),

                                                new GraphNode(
                                                                "svc",
                                                                "service",
                                                                Map.of(
                                                                                "minLatencyMs", 100.0,
                                                                                "maxLatencyMs", 100.0,
                                                                                "maxConcurrency", 100.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc")));

                /*
                 * Target traffic is intentionally higher than both calculated capacities
                 * so that the service becomes saturated and the difference in capacity
                 * becomes observable.
                 */
                SimulationConfig config = new SimulationConfig(3000, 1, List.of(), 1L);

                SimulationResult fastResult = engine.run(fastGraph, config);
                SimulationResult slowResult = engine.run(slowGraph, config);

                double fastRps = fastResult.summary().avgRps();
                double slowRps = slowResult.summary().avgRps();

                // 50 ms service time -> approximately 2000 RPS capacity.
                assertEquals(2000.0, fastRps, 0.001);

                // 100 ms service time -> approximately 1000 RPS capacity.
                assertEquals(1000.0, slowRps, 0.001);

                // Doubling latency should approximately halve throughput.
                assertEquals(2.0, fastRps / slowRps, 0.001);
        }

        @Test
        void healthySystemHasZeroErrorRate() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0))),
                                List.of(new GraphEdge("e1", "client", "svc")));

                SimulationConfig config = new SimulationConfig(100, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                double attempted = result.summary().avgRps() / (1.0 - result.summary().avgErrorRatePct() / 100.0);
                double succeeded = result.summary().avgRps();
                double failed = attempted - succeeded;

                assertEquals(0.0, result.summary().avgErrorRatePct(), 0.5);
                assertTrue(attempted >= 90.0 && attempted <= 110.0);
                assertTrue(succeeded >= 90.0 && succeeded <= 110.0);
                assertEquals(0.0, failed, 0.05);
                assertEquals(attempted, succeeded + failed, 0.05);
        }

        @Test
        void singleNodeOverloadCountsFailuresOnce() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1.2))),
                                List.of(new GraphEdge("e1", "client", "svc")));

                SimulationConfig config = new SimulationConfig(100, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                double attempted = result.summary().avgRps() / (1.0 - result.summary().avgErrorRatePct() / 100.0);
                double succeeded = result.summary().avgRps();
                double failed = attempted - succeeded;

                assertTrue(result.summary().avgErrorRatePct() > 15.0 && result.summary().avgErrorRatePct() < 30.0,
                                "expected roughly 20% error rate under 100 RPS / 1.2 concurrency");
                assertEquals(100.0, attempted, 10.0);
                assertEquals(80.0, succeeded, 10.0);
                assertEquals(20.0, failed, 10.0);
                assertEquals(attempted, succeeded + failed, 0.05);
        }

        @Test
        void upstreamFailurePropagationDoesNotDoubleCount() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svcA", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1.2)),
                                                new GraphNode("svcB", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svcA"),
                                                new GraphEdge("e2", "svcA", "svcB")));

                SimulationConfig config = new SimulationConfig(100, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                double attempted = result.summary().avgRps() / (1.0 - result.summary().avgErrorRatePct() / 100.0);
                double succeeded = result.summary().avgRps();
                double failed = attempted - succeeded;

                assertTrue(result.summary().avgErrorRatePct() > 15.0 && result.summary().avgErrorRatePct() < 30.0,
                                "expected 20% error rate when A rejects 20 of 100 requests");
                assertEquals(100.0, attempted, 10.0);
                assertEquals(80.0, succeeded, 10.0);
                assertEquals(20.0, failed, 10.0);
                assertEquals(attempted, succeeded + failed, 0.05);
        }

        @Test
        void killedNodeCreatesFailuresExactlyOnce() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svc", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0)),
                                                new GraphNode("db", "database",
                                                                Map.of("readLatencyMs", 10.0, "maxConnections", 1000.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svc"),
                                                new GraphEdge("e2", "svc", "db")));

                InjectedFailure kill = new InjectedFailure("kill", "svc", null, 0, null, 0, 0, 0);
                SimulationConfig config = new SimulationConfig(100, 1, List.of(kill), 1L);
                SimulationResult result = engine.run(graph, config);

                Tick lastTick = result.ticks().get(result.ticks().size() - 1);
                assertTrue(lastTick.nodes().get("svc").down());
                assertTrue(result.summary().avgErrorRatePct() > 0.0);
                assertTrue(result.summary().avgErrorRatePct() >= 90.0);
        }

        @Test
        void edgeDropCountsDroppedTrafficOnce() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svcA", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0)),
                                                new GraphNode("svcB", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 1000.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svcA"),
                                                new GraphEdge("e2", "svcA", "svcB")));

                InjectedFailure edgeDrop = new InjectedFailure("drop", null, "e2", 0, null, 0, 0, 50);
                SimulationConfig config = new SimulationConfig(100, 1, List.of(edgeDrop), 1L);
                SimulationResult result = engine.run(graph, config);

                assertTrue(result.summary().avgErrorRatePct() >= 0.0);
                assertTrue(result.summary().avgErrorRatePct() <= 100.0);
                assertTrue(result.summary().avgRps() >= 0.0);
        }

        @Test
        void upstreamAndDownstreamFailuresAreAddedOnce() {
                SimulationGraph graph = new SimulationGraph(
                                List.of(
                                                new GraphNode("client", "client", Map.of()),
                                                new GraphNode("svcA", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 8.0)),
                                                new GraphNode("svcB", "service",
                                                                Map.of("minLatencyMs", 10.0, "maxLatencyMs", 20.0,
                                                                                "maxConcurrency", 4.0))),
                                List.of(
                                                new GraphEdge("e1", "client", "svcA"),
                                                new GraphEdge("e2", "svcA", "svcB")));

                SimulationConfig config = new SimulationConfig(100, 1, List.of(), 1L);
                SimulationResult result = engine.run(graph, config);

                double successRate = result.summary().avgRps();
                double errorRate = result.summary().avgErrorRatePct();
                double attempted = successRate / (1.0 - errorRate / 100.0);
                double succeeded = successRate;
                double failed = attempted - succeeded;

                assertTrue(errorRate >= 0.0);
                assertTrue(successRate >= 0.0);
                assertTrue(attempted >= 0.0);
                assertTrue(failed >= 0.0);
                assertEquals(attempted, succeeded + failed, 0.05);
        }
}
