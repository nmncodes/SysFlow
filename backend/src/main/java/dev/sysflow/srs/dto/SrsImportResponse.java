package dev.sysflow.srs.dto;

import dev.sysflow.ai.dto.Finding;

import java.util.List;
import java.util.Map;

/**
 * Response for POST /api/srs/import — a graph auto-generated from an
 * uploaded SRS/requirements document, ready to load straight into the
 * editor (same shape as a saved project's graphJson), plus the same
 * rule-engine + Gemini trade-off findings the "Analyze" button produces.
 */
public record SrsImportResponse(
        GraphJson graphJson,
        List<Finding> findings,
        boolean aiEnabled,
        List<String> unrecognizedTerms
) {
    public record GraphJson(List<NodeJson> nodes, List<EdgeJson> edges) {
    }

    public record NodeJson(String id, String type, String label, Map<String, Object> config, Position position) {
    }

    public record EdgeJson(String id, String source, String target) {
    }

    public record Position(double x, double y) {
    }
}
