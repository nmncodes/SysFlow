package dev.sysflow.simulation.dto;

import dev.sysflow.simulation.model.InjectedFailure;

import java.util.List;
import java.util.Map;

public record SimulationRunRequest(GraphJson graphJson, SimConfigJson config) {

    public record GraphJson(List<NodeJson> nodes, List<EdgeJson> edges) {
    }

    public record NodeJson(String id, String type, Map<String, Object> config) {
    }

    public record EdgeJson(String id, String source, String target) {
    }

    public record SimConfigJson(
            double targetRps,
            int durationSeconds,
            List<InjectedFailure> injectedFailures,
            Long randomSeed
    ) {
    }
}
