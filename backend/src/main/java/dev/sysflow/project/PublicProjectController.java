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
 * Read-only, unauthenticated views. Gallery detail is available only for an
 * explicitly published project; private project sharing requires a separate,
 * revocable capability token.
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
    public ProjectResponse getPublished(@PathVariable UUID id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        if (!project.isPublicTemplate()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        }
        return toResponse(project);
    }

    @GetMapping("/share/{token}")
    public ProjectResponse getShared(@PathVariable UUID token) {
        Project project = projectRepository.findByShareToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share link not found or has been revoked"));
        return toResponse(project);
    }

    private ProjectResponse toResponse(Project project) {
        try {
            JsonNode graph = objectMapper.readTree(project.getGraphJson());
            return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), graph, project.getCreatedAt(), project.getUpdatedAt(), project.isPublicTemplate());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt project data");
        }
    }
}
