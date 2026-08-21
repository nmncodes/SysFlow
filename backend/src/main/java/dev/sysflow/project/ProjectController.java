package dev.sysflow.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.project.dto.ProjectRequest;
import dev.sysflow.project.dto.ProjectResponse;
import dev.sysflow.project.dto.ProjectSummaryResponse;
import dev.sysflow.project.dto.ProjectVersionDetailResponse;
import dev.sysflow.project.dto.ProjectVersionSummaryResponse;
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

    /** How many prior snapshots we keep per project — see docs/05-ROADMAP.md Phase 9. */
    private static final int MAX_VERSIONS_PER_PROJECT = 10;

    private final ProjectRepository projectRepository;
    private final ProjectVersionRepository projectVersionRepository;
    private final ObjectMapper objectMapper;

    public ProjectController(
            ProjectRepository projectRepository,
            ProjectVersionRepository projectVersionRepository,
            ObjectMapper objectMapper
    ) {
        this.projectRepository = projectRepository;
        this.projectVersionRepository = projectVersionRepository;
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
            String newGraphJson = writeJson(request.graphJson());
            if (!newGraphJson.equals(project.getGraphJson())) {
                snapshotVersion(project);
                project.setGraphJson(newGraphJson);
            }
        }
        projectRepository.save(project);
        return toResponse(project);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        projectVersionRepository.deleteAll(projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId()));
        projectRepository.delete(project);
    }

    @GetMapping("/{id}/versions")
    public List<ProjectVersionSummaryResponse> listVersions(@PathVariable UUID id, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        return projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId()).stream()
                .map(v -> new ProjectVersionSummaryResponse(v.getId(), v.getCreatedAt()))
                .toList();
    }

    @GetMapping("/{id}/versions/{versionId}")
    public ProjectVersionDetailResponse getVersion(@PathVariable UUID id, @PathVariable UUID versionId, Authentication auth) {
        findOwned(id, userId(auth));
        ProjectVersion version = findOwnedVersion(id, versionId);
        return new ProjectVersionDetailResponse(version.getId(), readJson(version.getGraphJson()), version.getCreatedAt());
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ProjectResponse restoreVersion(@PathVariable UUID id, @PathVariable UUID versionId, Authentication auth) {
        Project project = findOwned(id, userId(auth));
        ProjectVersion version = findOwnedVersion(id, versionId);
        snapshotVersion(project); // so restoring is itself undoable
        project.setGraphJson(version.getGraphJson());
        projectRepository.save(project);
        return toResponse(project);
    }

    /** Saves the project's current graph as a version, then prunes anything past the retention limit. */
    private void snapshotVersion(Project project) {
        projectVersionRepository.save(new ProjectVersion(project.getId(), project.getGraphJson()));
        List<ProjectVersion> versions = projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId());
        if (versions.size() > MAX_VERSIONS_PER_PROJECT) {
            projectVersionRepository.deleteAll(versions.subList(MAX_VERSIONS_PER_PROJECT, versions.size()));
        }
    }

    private ProjectVersion findOwnedVersion(UUID projectId, UUID versionId) {
        ProjectVersion version = projectVersionRepository.findById(versionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found"));
        if (!version.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found");
        }
        return version;
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

    private JsonNode readJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt version data");
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
