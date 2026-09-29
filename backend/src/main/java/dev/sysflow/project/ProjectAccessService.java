package dev.sysflow.project;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Centralizes owner/editor/viewer checks so REST and STOMP apply identical rules. */
@Service
public class ProjectAccessService {

    private final ProjectRepository projectRepository;
    private final ProjectCollaboratorRepository collaboratorRepository;

    public ProjectAccessService(ProjectRepository projectRepository, ProjectCollaboratorRepository collaboratorRepository) {
        this.projectRepository = projectRepository;
        this.collaboratorRepository = collaboratorRepository;
    }

    public Project requireView(UUID projectId, UUID userId) {
        Project project = requireProject(projectId);
        if (project.getUserId().equals(userId) || collaboratorRepository.findByProjectIdAndUserId(projectId, userId).isPresent()) {
            return project;
        }
        throw notFound();
    }

    public Project requireEdit(UUID projectId, UUID userId) {
        Project project = requireProject(projectId);
        if (project.getUserId().equals(userId)) return project;
        boolean canEdit = collaboratorRepository.findByProjectIdAndUserId(projectId, userId)
                .map(c -> c.getRole() == CollaboratorRole.EDITOR)
                .orElse(false);
        if (canEdit) return project;
        throw notFound();
    }

    public Project requireOwner(UUID projectId, UUID userId) {
        Project project = requireProject(projectId);
        if (!project.getUserId().equals(userId)) throw notFound();
        return project;
    }

    public CollaboratorRole roleFor(Project project, UUID userId) {
        if (project.getUserId().equals(userId)) return CollaboratorRole.EDITOR;
        return collaboratorRepository.findByProjectIdAndUserId(project.getId(), userId)
                .map(ProjectCollaborator::getRole)
                .orElseThrow(this::notFound);
    }

    private Project requireProject(UUID projectId) {
        return projectRepository.findById(projectId).orElseThrow(this::notFound);
    }

    private ResponseStatusException notFound() {
        // Do not disclose a project's existence to users outside its membership.
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
    }
}
