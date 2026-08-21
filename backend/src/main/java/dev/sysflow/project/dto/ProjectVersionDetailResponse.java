package dev.sysflow.project.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record ProjectVersionDetailResponse(UUID id, JsonNode graphJson, Instant createdAt) {
}
