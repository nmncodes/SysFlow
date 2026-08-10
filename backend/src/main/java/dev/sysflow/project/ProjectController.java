package dev.sysflow.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.project.dto.ProjectRequest;
import dev.sysflow.project.dto.ProjectResponse;
import dev.sysflow.project.dto.ProjectSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ObjectMapper objectMapper;

    public ProjectController(ProjectRepository projectRepository, ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public List<ProjectSummaryResponse> list(Authentication auth) {
        UUID userId = userId(auth);
        return projectRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(p -> new ProjectSummaryResponse(p.getId(), p.getName(), p.getDescription(), p.getCreatedAt(), p.getUpdatedAt()))
                .toList();
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable UUID id, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        return toResponse(project);
    }

    @PostMapping
    public ProjectResponse create(@Valid @RequestBody ProjectRequest request, Authentication auth) {
        Project project = new Project(userId(auth), request.name(), request.description(), writeJson(request.graphJson()));
        projectRepository.save(project);
        return toResponse(project);
    }

    @PutMapping("/{id}")
    public ProjectResponse update(@PathVariable UUID id, @Valid @RequestBody ProjectRequest request, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        project.setName(request.name());
        project.setDescription(request.description());
        if (request.graphJson() != null) {
            project.setGraphJson(writeJson(request.graphJson()));
        }
        projectRepository.save(project);
        return toResponse(project);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        projectRepository.delete(project);
    }

    private Project findOwned(UUID id, UUID userId) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        if (!project.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        }
        return project;
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid graphJson");
        }
    }

    private ProjectResponse toResponse(Project project) {
        try {
            JsonNode graph = objectMapper.readTree(project.getGraphJson());
            return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), graph, project.getCreatedAt(), project.getUpdatedAt());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt project data");
        }
    }
}
