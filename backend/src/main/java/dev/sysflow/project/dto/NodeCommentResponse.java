package dev.sysflow.project.dto;

import java.time.Instant;
import java.util.UUID;

public record NodeCommentResponse(UUID id, String nodeId, String authorName, String text, Instant createdAt) {
}
