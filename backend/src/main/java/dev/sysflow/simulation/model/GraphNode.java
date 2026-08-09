package dev.sysflow.simulation.model;

import java.util.Map;

public record GraphNode(String id, String type, Map<String, Object> config) {

    public double getNumber(String key, double fallback) {
        Object v = config == null ? null : config.get(key);
        if (v instanceof Number n) return n.doubleValue();
        return fallback;
    }

    public String getString(String key, String fallback) {
        Object v = config == null ? null : config.get(key);
        return v instanceof String s ? s : fallback;
    }
}
