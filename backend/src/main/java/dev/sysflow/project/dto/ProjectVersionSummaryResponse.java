package dev.sysflow.project.dto;

import java.time.Instant;
import java.util.UUID;

public record ProjectVersionSummaryResponse(UUID id, Instant createdAt) {
}
