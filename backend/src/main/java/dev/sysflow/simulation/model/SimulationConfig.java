package dev.sysflow.simulation.model;

import java.util.List;

public record SimulationConfig(
        double targetRps,
        int durationSeconds,
        List<InjectedFailure> injectedFailures,
        long randomSeed
) {
    public static final int TICKS_PER_SECOND = 10;

    public int totalTicks() {
        return Math.max(1, durationSeconds * TICKS_PER_SECOND);
    }
}
