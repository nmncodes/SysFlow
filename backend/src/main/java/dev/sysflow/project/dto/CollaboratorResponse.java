package dev.sysflow.project.dto;

import dev.sysflow.project.CollaboratorRole;

import java.util.UUID;

public record CollaboratorResponse(UUID userId, String email, String displayName, CollaboratorRole role, boolean owner) {
}
