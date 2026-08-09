package dev.sysflow.simulation;

import dev.sysflow.simulation.dto.SimulationRunRequest;
import dev.sysflow.simulation.model.*;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @PostMapping("/run")
    public SimulationResult run(@RequestBody SimulationRunRequest request) {
        List<GraphNode> nodes = request.graphJson().nodes().stream()
                .map(n -> new GraphNode(n.id(), n.type(), n.config()))
                .toList();
        List<GraphEdge> edges = request.graphJson().edges().stream()
                .map(e -> new GraphEdge(e.id(), e.source(), e.target()))
                .toList();
        SimulationGraph graph = new SimulationGraph(nodes, edges);

        SimulationRunRequest.SimConfigJson c = request.config();
        SimulationConfig config = new SimulationConfig(
                c.targetRps(),
                c.durationSeconds(),
                c.injectedFailures() == null ? List.of() : c.injectedFailures(),
                c.randomSeed() == null ? 42L : c.randomSeed()
        );

        return engine.run(graph, config);
    }
}
