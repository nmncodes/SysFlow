package dev.sysflow.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectCollaboratorRepository extends JpaRepository<ProjectCollaborator, UUID> {
    Optional<ProjectCollaborator> findByProjectIdAndUserId(UUID projectId, UUID userId);
    List<ProjectCollaborator> findByProjectIdOrderByCreatedAtAsc(UUID projectId);
    List<ProjectCollaborator> findByUserId(UUID userId);
    void deleteByProjectId(UUID projectId);
}
