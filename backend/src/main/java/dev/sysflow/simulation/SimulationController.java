package dev.sysflow.simulation;

import dev.sysflow.simulation.dto.SimulationRunRequest;
import dev.sysflow.simulation.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Implements the /api/simulations/run contract from
 * docs/04-DATA-MODEL-AND-API.md, backed by SimulationEngine
 * (docs/02-ARCHITECTURE.md §4).
 */
@RestController
@RequestMapping("/api/simulations")
public class SimulationController {

    private final SimulationEngine engine;

    public SimulationController(SimulationEngine engine) {
        this.engine = engine;
    }

    private static final int MAX_NODES = 200;
    private static final int MAX_EDGES = 500;
    private static final int MAX_DURATION_SECONDS = 300;
    private static final double MAX_TARGET_RPS = 100_000;

    @PostMapping("/run")
    public SimulationResult run(@RequestBody SimulationRunRequest request) {
        if (request.graphJson() == null || request.config() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "graphJson and config are required");
        }
        if (request.graphJson().nodes() == null || request.graphJson().edges() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nodes and edges are required");
        }
        if (request.graphJson().nodes().size() > MAX_NODES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Graph exceeds maximum of " + MAX_NODES + " nodes");
        }
        if (request.graphJson().edges().size() > MAX_EDGES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Graph exceeds maximum of " + MAX_EDGES + " edges");
        }
        List<GraphNode> nodes = request.graphJson().nodes().stream()
                .map(n -> new GraphNode(n.id(), n.type(), n.config()))
                .toList();
        List<GraphEdge> edges = request.graphJson().edges().stream()
                .map(e -> new GraphEdge(e.id(), e.source(), e.target()))
                .toList();
        SimulationGraph graph = new SimulationGraph(nodes, edges);

        SimulationRunRequest.SimConfigJson c = request.config();
        double clampedRps = Math.min(Math.max(c.targetRps(), 1), MAX_TARGET_RPS);
        int clampedDuration = Math.min(Math.max(c.durationSeconds(), 1), MAX_DURATION_SECONDS);
        SimulationConfig config = new SimulationConfig(
                clampedRps,
                clampedDuration,
                c.injectedFailures() == null ? List.of() : c.injectedFailures(),
                c.randomSeed() == null ? 42L : c.randomSeed()
        );

        return engine.run(graph, config);
    }
}
