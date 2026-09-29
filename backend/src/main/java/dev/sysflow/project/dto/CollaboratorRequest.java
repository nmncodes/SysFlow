package dev.sysflow.project.dto;

import dev.sysflow.project.CollaboratorRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CollaboratorRequest(@NotBlank @Email String email, @NotNull CollaboratorRole role) {
}
