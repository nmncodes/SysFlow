package dev.sysflow.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.project.dto.ProjectResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Read-only, unauthenticated project view — the project's UUID doubles as an
 * unguessable share token (no separate share-link/visibility model for MVP).
 * Intentionally NOT under /api/projects/** so it isn't caught by that
 * matcher's .authenticated() rule in SecurityConfig.
 */
@RestController
@RequestMapping("/api/public/projects")
public class PublicProjectController {

    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    public PublicProjectController(ProjectRepository projectRepository, ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable UUID id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        try {
            JsonNode graph = objectMapper.readTree(project.getGraphJson());
            return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), graph, project.getCreatedAt(), project.getUpdatedAt());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt project data");
        }
    }
}
