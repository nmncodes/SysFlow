package dev.sysflow.srs.dto;

import java.util.List;

/** Shape Gemini is asked to return — validated/cleaned up into SrsImportResponse by SrsGraphExtractor. */
public record RawExtraction(List<RawNode> nodes, List<RawEdge> edges) {

    /**
     * replicaCount is only populated when the document explicitly states a replica/failover
     * requirement for a database-like node — left null otherwise so we don't fabricate an HA
     * guarantee the spec never made (see SrsController.toConfig).
     */
    public record RawNode(String id, String type, String label, String sourceTerm, Integer replicaCount) {
    }

    public record RawEdge(String source, String target) {
    }
}
