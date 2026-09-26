package dev.sysflow.simulation.model;

/**
 * One user-triggered fault, matching docs/04-DATA-MODEL-AND-API.md's
 * injectedFailures[] shape. type is one of: "kill", "latency", "throttle", "dropPct".
 * "kill"/"latency"/"throttle" target a nodeId; "dropPct" targets an edgeId.
 */
public record InjectedFailure(
        String type,
        String nodeId,
        String edgeId,
        int fromTick,
        Integer toTick,
        double extraMs,
        double throttlePct,
        double dropPct
) {
    public boolean activeAt(int tick) {
        if (tick < fromTick) return false;
        return toTick == null || tick <= toTick;
    }
}
