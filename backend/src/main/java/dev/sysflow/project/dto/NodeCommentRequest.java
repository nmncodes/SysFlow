package dev.sysflow.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NodeCommentRequest(
        @NotBlank String nodeId,
        @NotBlank @Size(max = 2000) String text
) {
}
