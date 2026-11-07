package dev.sysflow.project;

import dev.sysflow.auth.User;
import dev.sysflow.auth.UserRepository;
import dev.sysflow.project.dto.CollaboratorRequest;
import dev.sysflow.project.dto.CollaboratorResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Owner-only membership management for real-time collaboration. */
@RestController
@RequestMapping("/api/projects/{projectId}/collaborators")
public class ProjectCollaboratorController {

    private final ProjectAccessService access;
    private final ProjectCollaboratorRepository collaboratorRepository;
    private final UserRepository userRepository;

    public ProjectCollaboratorController(ProjectAccessService access, ProjectCollaboratorRepository collaboratorRepository, UserRepository userRepository) {
        this.access = access;
        this.collaboratorRepository = collaboratorRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<CollaboratorResponse> list(@PathVariable UUID projectId, Authentication auth) {
        Project project = access.requireView(projectId, userId(auth));
        List<ProjectCollaborator> members = collaboratorRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        Set<UUID> userIds = new java.util.LinkedHashSet<>();
        userIds.add(project.getUserId());
        members.forEach(m -> userIds.add(m.getUserId()));
        Map<UUID, User> usersById = userRepository.findAllById(userIds).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));
        Map<UUID, CollaboratorRole> roleByUser = members.stream()
                .collect(java.util.stream.Collectors.toMap(ProjectCollaborator::getUserId, ProjectCollaborator::getRole));
        List<CollaboratorResponse> result = new ArrayList<>();
        User owner = usersById.get(project.getUserId());
        if (owner != null) result.add(toResponse(owner, CollaboratorRole.EDITOR, true));
        for (ProjectCollaborator member : members) {
            User user = usersById.get(member.getUserId());
            if (user != null) result.add(toResponse(user, member.getRole(), false));
        }
        return result;
    }

    @PutMapping
    public CollaboratorResponse grant(@PathVariable UUID projectId, @Valid @RequestBody CollaboratorRequest request, Authentication auth) {
        Project project = access.requireOwner(projectId, userId(auth));
        User user = userRepository.findByEmail(request.email().trim().toLowerCase(java.util.Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No SysFlow account exists for that email"));
        if (user.getId().equals(project.getUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The project owner already has editor access");
        }
        ProjectCollaborator member = collaboratorRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseGet(() -> new ProjectCollaborator(projectId, user.getId(), request.role()));
        member.setRole(request.role());
        collaboratorRepository.save(member);
        return toResponse(user, member.getRole(), false);
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID projectId, @PathVariable UUID userId, Authentication auth) {
        access.requireOwner(projectId, userId(auth));
        ProjectCollaborator member = collaboratorRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Collaborator not found"));
        collaboratorRepository.delete(member);
    }

    private CollaboratorResponse toResponse(User user, CollaboratorRole role, boolean owner) {
        return new CollaboratorResponse(user.getId(), user.getEmail(), user.getDisplayName(), role, owner);
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
