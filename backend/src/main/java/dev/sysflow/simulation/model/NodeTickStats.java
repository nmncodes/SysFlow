package dev.sysflow.simulation.model;

public record NodeTickStats(double loadPct, double errorRatePct, double avgLatencyMs, boolean down) {
}
