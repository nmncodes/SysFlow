package dev.sysflow.simulation.model;

import java.util.List;

public record SimulationConfig(
        double targetRps,
        int durationSeconds,
        List<InjectedFailure> injectedFailures,
        long randomSeed
) {
    public static final int TICKS_PER_SECOND = 10;

    private static final int MAX_DURATION_SECONDS = 600;
    private static final double MAX_TARGET_RPS = 10_000;

    public int totalTicks() {
        return Math.max(1, Math.min(durationSeconds, MAX_DURATION_SECONDS) * TICKS_PER_SECOND);
    }

    public double clampedTargetRps() {
        return Math.max(0, Math.min(targetRps, MAX_TARGET_RPS));
    }
}
