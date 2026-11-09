package dev.sysflow.project.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProjectRequest(@Size(max = 200) String name,
                             @Size(max = 2000) String description,
                             JsonNode graphJson,
                             Long collaborationRevision, String collaborationClientId) {
}
