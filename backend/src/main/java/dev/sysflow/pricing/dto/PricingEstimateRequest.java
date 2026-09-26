package dev.sysflow.pricing.dto;

import java.util.List;
import java.util.Map;

public record PricingEstimateRequest(GraphJson graphJson) {
    public record GraphJson(List<NodeJson> nodes) {
    }

    public record NodeJson(String id, String type, Map<String, Object> config) {
    }
}
