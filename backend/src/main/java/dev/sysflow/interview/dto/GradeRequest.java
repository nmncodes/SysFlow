package dev.sysflow.interview.dto;

import dev.sysflow.ai.dto.AnalyzeRequest;

public record GradeRequest(String promptId, AnalyzeRequest.GraphJson graphJson) {
}
