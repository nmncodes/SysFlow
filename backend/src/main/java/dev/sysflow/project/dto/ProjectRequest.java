package dev.sysflow.project.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;

public record ProjectRequest(@NotBlank String name, String description, JsonNode graphJson) {
}
