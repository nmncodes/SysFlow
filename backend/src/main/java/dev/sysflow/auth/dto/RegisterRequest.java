package dev.sysflow.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8, max = 128, message = "password must be between 8 and 128 characters")
        @jakarta.validation.constraints.Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
                message = "password must contain at least one uppercase letter, one lowercase letter, and one digit")
        String password,
        @Size(max = 100) @jakarta.validation.constraints.Pattern(regexp = "^[\\p{L}\\p{N} .'-]*$",
                message = "display name contains invalid characters")
        String displayName
) {
}
