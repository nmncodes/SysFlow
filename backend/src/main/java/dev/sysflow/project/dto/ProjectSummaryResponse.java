package dev.sysflow.project.dto;

import java.time.Instant;
import java.util.UUID;

/** Metadata only, no graphJson — for the project list view per docs/04-DATA-MODEL-AND-API.md. */
public record ProjectSummaryResponse(UUID id, String name, String description, Instant createdAt, Instant updatedAt) {
}
