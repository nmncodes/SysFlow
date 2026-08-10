package dev.sysflow.ai.dto;

import java.util.List;

/**
 * Matches the findings[] shape from docs/04-DATA-MODEL-AND-API.md's
 * /api/ai/analyze contract. severity: "critical" | "warning" | "info".
 */
public record Finding(
        String severity,
        String title,
        List<String> affectedNodeIds,
        String explanation,
        String recommendation
) {
}
