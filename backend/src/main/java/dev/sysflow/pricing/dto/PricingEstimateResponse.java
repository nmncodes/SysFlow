package dev.sysflow.pricing.dto;

import java.util.List;

public record PricingEstimateResponse(
        double totalMonthlyCostUsd,
        String provider,
        String region,
        List<NodeCost> nodes
) {
    public record NodeCost(String id, String type, double monthlyCostUsd, String source, String note) {
    }
}
