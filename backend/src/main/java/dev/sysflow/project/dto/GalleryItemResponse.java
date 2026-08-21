package dev.sysflow.project.dto;

import java.time.Instant;
import java.util.UUID;

public record GalleryItemResponse(
        UUID id,
        String name,
        String description,
        String authorName,
        int nodeCount,
        Instant updatedAt
) {
}
