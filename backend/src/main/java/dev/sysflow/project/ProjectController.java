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
    private final NodeCommentRepository nodeCommentRepository;
    private final ProjectCollaboratorRepository collaboratorRepository;
    private final ProjectAccessService access;
    private final ObjectMapper objectMapper;

    public ProjectController(
            ProjectRepository projectRepository,
            ProjectVersionRepository projectVersionRepository,
            NodeCommentRepository nodeCommentRepository,
            ProjectCollaboratorRepository collaboratorRepository,
            ProjectAccessService access,
            ObjectMapper objectMapper
    ) {
        this.projectRepository = projectRepository;
        this.projectVersionRepository = projectVersionRepository;
        this.nodeCommentRepository = nodeCommentRepository;
        this.collaboratorRepository = collaboratorRepository;
        this.access = access;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public List<ProjectSummaryResponse> list(Authentication auth) {
        UUID userId = userId(auth);
        return projectRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(p -> summary(p, CollaboratorRole.EDITOR))
                .toList();
    }

    @GetMapping("/shared-with-me")
    public List<ProjectSummaryResponse> sharedWithMe(Authentication auth) {
        return collaboratorRepository.findByUserId(userId(auth)).stream()
                .map(member -> projectRepository.findById(member.getProjectId())
                        .map(project -> summary(project, member.getRole()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable UUID id, Authentication auth) {
        Project project = access.requireView(id, userId(auth));
        return toResponse(project);
    }

    @PutMapping("/{id}/publish")
    public ProjectResponse setPublished(@PathVariable UUID id, @RequestBody PublishRequest request, Authentication auth) {
        Project project = access.requireOwner(id, userId(auth));
        project.setPublicTemplate(request.publish());
        projectRepository.save(project);
        return toResponse(project);
    }

    public record PublishRequest(boolean publish) {
    }

    public record ShareLinkResponse(UUID token) {
    }

    /** Creates (or returns) the stable, revocable anonymous read-only link for an owned project. */
    @PostMapping("/{id}/share")
    public ShareLinkResponse createShareLink(@PathVariable UUID id, Authentication auth) {
        Project project = access.requireOwner(id, userId(auth));
        UUID token = project.createShareToken();
        projectRepository.save(project);
        return new ShareLinkResponse(token);
    }

    /** Immediately invalidates a previously issued share link. */
    @DeleteMapping("/{id}/share")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeShareLink(@PathVariable UUID id, Authentication auth) {
        Project project = access.requireOwner(id, userId(auth));
        project.revokeShareToken();
        projectRepository.save(project);
    }

    @PostMapping
    public ProjectResponse create(@Valid @RequestBody ProjectRequest request, Authentication auth) {
        Project project = new Project(userId(auth), request.name(), request.description(), writeJson(request.graphJson()));
        projectRepository.save(project);
        return toResponse(project);
    }

    @PutMapping("/{id}")
    public ProjectResponse update(@PathVariable UUID id, @Valid @RequestBody ProjectRequest request, Authentication auth) {
        Project project = access.requireEdit(id, userId(auth));
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
        Project project = access.requireOwner(id, userId(auth));
        projectVersionRepository.deleteAll(projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId()));
        nodeCommentRepository.deleteByProjectId(project.getId());
        collaboratorRepository.deleteByProjectId(project.getId());
        projectRepository.delete(project);
    }

    @GetMapping("/{id}/versions")
    public List<ProjectVersionSummaryResponse> listVersions(@PathVariable UUID id, Authentication auth) {
        Project project = access.requireView(id, userId(auth));
        return projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId()).stream()
                .map(v -> new ProjectVersionSummaryResponse(v.getId(), v.getCreatedAt()))
                .toList();
    }

    @GetMapping("/{id}/versions/{versionId}")
    public ProjectVersionDetailResponse getVersion(@PathVariable UUID id, @PathVariable UUID versionId, Authentication auth) {
        access.requireView(id, userId(auth));
        ProjectVersion version = findOwnedVersion(id, versionId);
        return new ProjectVersionDetailResponse(version.getId(), readJson(version.getGraphJson()), version.getCreatedAt());
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public ProjectResponse restoreVersion(@PathVariable UUID id, @PathVariable UUID versionId, Authentication auth) {
        Project project = access.requireEdit(id, userId(auth));
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

    private ProjectSummaryResponse summary(Project project, CollaboratorRole role) {
        return new ProjectSummaryResponse(project.getId(), project.getName(), project.getDescription(), project.getCreatedAt(),
                project.getUpdatedAt(), project.isPublicTemplate(), project.getShareToken() != null, role.name());
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
            return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), graph, project.getCreatedAt(), project.getUpdatedAt(), project.isPublicTemplate());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt project data");
        }
    }
}
