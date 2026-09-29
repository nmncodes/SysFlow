package dev.sysflow.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sysflow.collab.CollaborativeGraphService;
import dev.sysflow.project.dto.ProjectRequest;
import dev.sysflow.project.dto.ProjectResponse;
import dev.sysflow.project.dto.ProjectSummaryResponse;
import dev.sysflow.project.dto.ProjectVersionDetailResponse;
import dev.sysflow.project.dto.ProjectVersionSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
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
    private final CollaborativeGraphService collaborativeGraphService;
    private final SimpMessagingTemplate messagingTemplate;

    public ProjectController(
            ProjectRepository projectRepository,
            ProjectVersionRepository projectVersionRepository,
            NodeCommentRepository nodeCommentRepository,
            ProjectCollaboratorRepository collaboratorRepository,
            ProjectAccessService access,
            ObjectMapper objectMapper,
            CollaborativeGraphService collaborativeGraphService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.projectRepository = projectRepository;
        this.projectVersionRepository = projectVersionRepository;
        this.nodeCommentRepository = nodeCommentRepository;
        this.collaboratorRepository = collaboratorRepository;
        this.access = access;
        this.objectMapper = objectMapper;
        this.collaborativeGraphService = collaborativeGraphService;
        this.messagingTemplate = messagingTemplate;
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
        return toResponse(project, access.roleFor(project, userId(auth)));
    }

    @PutMapping("/{id}/publish")
    public ProjectResponse setPublished(@PathVariable UUID id, @RequestBody PublishRequest request, Authentication auth) {
        Project project = access.requireOwner(id, userId(auth));
        project.setPublicTemplate(request.publish());
        projectRepository.save(project);
        return toResponse(project, CollaboratorRole.EDITOR);
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
        return toResponse(project, CollaboratorRole.EDITOR);
    }

    @PutMapping("/{id}")
    public ProjectResponse update(@PathVariable UUID id, @Valid @RequestBody ProjectRequest request, Authentication auth) {
        Project project = access.requireEdit(id, userId(auth));
        CollaborativeGraphService.Result graphUpdate = null;
        if (request.graphJson() != null) {
            JsonNode submittedGraph = request.graphJson();
            JsonNode persistedGraph = readJson(project.getGraphJson());
            long baseRevision = request.collaborationRevision() == null ? 0L : request.collaborationRevision();
            graphUpdate = collaborativeGraphService.apply(id, baseRevision, submittedGraph, persistedGraph);
            if (!graphUpdate.accepted()) {
                if (request.collaborationClientId() != null) {
                    messagingTemplate.convertAndSendToUser(userId(auth).toString(), "/queue/collaboration-conflicts", Map.of(
                            "type", "conflict",
                            "clientId", request.collaborationClientId(),
                            "revision", graphUpdate.revision(),
                            "payload", graphUpdate.graph(),
                            "conflicts", graphUpdate.conflicts()
                    ));
                }
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "The graph changed at the same time. Resolve the live collaboration conflict before saving.");
            }
            String canonicalGraphJson = writeJson(graphUpdate.graph());
            if (!canonicalGraphJson.equals(project.getGraphJson())) {
                snapshotVersion(project);
                project.setGraphJson(canonicalGraphJson);
            }
        }
        project.setName(request.name());
        project.setDescription(request.description());
        projectRepository.save(project);
        if (graphUpdate != null) broadcastGraphUpdate(project, graphUpdate);
        return toResponse(project, access.roleFor(project, userId(auth)), graphUpdate == null ? null : graphUpdate.revision());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id, Authentication auth) {
        Project project = access.requireOwner(id, userId(auth));
        projectVersionRepository.deleteAll(projectVersionRepository.findByProjectIdOrderByCreatedAtDesc(project.getId()));
        nodeCommentRepository.deleteByProjectId(project.getId());
        collaboratorRepository.deleteByProjectId(project.getId());
        collaborativeGraphService.remove(project.getId());
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
        JsonNode persistedGraph = readJson(project.getGraphJson());
        CollaborativeGraphService.Result current = collaborativeGraphService.snapshot(id, persistedGraph);
        CollaborativeGraphService.Result graphUpdate = collaborativeGraphService.apply(
                id, current.revision(), readJson(version.getGraphJson()), persistedGraph);
        if (!graphUpdate.accepted()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The graph changed at the same time. Resolve the live collaboration conflict before restoring.");
        }
        snapshotVersion(project); // so restoring is itself undoable
        project.setGraphJson(writeJson(graphUpdate.graph()));
        projectRepository.save(project);
        broadcastGraphUpdate(project, graphUpdate);
        return toResponse(project, access.roleFor(project, userId(auth)), graphUpdate.revision());
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

    private ProjectResponse toResponse(Project project, CollaboratorRole role) {
        try {
            JsonNode graph = objectMapper.readTree(project.getGraphJson());
            return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), graph, project.getCreatedAt(), project.getUpdatedAt(), project.isPublicTemplate(), role.name(), null);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Corrupt project data");
        }
    }

    private ProjectResponse toResponse(Project project, CollaboratorRole role, Long collaborationRevision) {
        ProjectResponse response = toResponse(project, role);
        return new ProjectResponse(response.id(), response.name(), response.description(), response.graphJson(),
                response.createdAt(), response.updatedAt(), response.isPublicTemplate(), response.accessRole(), collaborationRevision);
    }

    private void broadcastGraphUpdate(Project project, CollaborativeGraphService.Result update) {
        Map<String, Object> event = Map.of(
                "type", "graph",
                "clientId", "server",
                "revision", update.revision(),
                "payload", update.graph()
        );
        Set<UUID> members = new LinkedHashSet<>();
        members.add(project.getUserId());
        collaboratorRepository.findByProjectIdOrderByCreatedAtAsc(project.getId())
                .forEach(collaborator -> members.add(collaborator.getUserId()));
        for (UUID memberId : members) {
            messagingTemplate.convertAndSendToUser(memberId.toString(), "/queue/project/" + project.getId(), event);
        }
    }
}
