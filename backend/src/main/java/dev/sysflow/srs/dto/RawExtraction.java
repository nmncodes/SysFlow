package dev.sysflow.srs.dto;

import java.util.List;

/** Shape Gemini is asked to return — validated/cleaned up into SrsImportResponse by SrsGraphExtractor. */
public record RawExtraction(List<RawNode> nodes, List<RawEdge> edges) {

    /**
     * replicaCount, capacityHint, and cacheHitRatePct are only populated when the document
     * explicitly ties that specific numeric requirement to this specific component — left null
     * otherwise so we don't fabricate a guarantee the spec never made (see SrsController.toConfig).
     */
    public record RawNode(
            String id, String type, String label, String sourceTerm,
            Integer replicaCount, Double capacityHint, Integer cacheHitRatePct
    ) {
    }

    public record RawEdge(String source, String target) {
    }
}
