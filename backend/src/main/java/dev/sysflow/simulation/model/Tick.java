package dev.sysflow.simulation.model;

import java.util.Map;

public record Tick(
        int t,
        Map<String, NodeTickStats> nodes,
        Map<String, EdgeTickStats> edges,
        GlobalTickStats global
) {
}
