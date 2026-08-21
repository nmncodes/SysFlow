package dev.sysflow.project.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String description,
        JsonNode graphJson,
        Instant createdAt,
        Instant updatedAt,
        boolean isPublicTemplate
) {
}
