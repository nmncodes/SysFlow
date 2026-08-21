package dev.sysflow.srs.dto;

import java.util.List;

/** Shape Gemini is asked to return — validated/cleaned up into SrsImportResponse by SrsGraphExtractor. */
public record RawExtraction(List<RawNode> nodes, List<RawEdge> edges) {

    public record RawNode(String id, String type, String label, String sourceTerm) {
    }

    public record RawEdge(String source, String target) {
    }
}
