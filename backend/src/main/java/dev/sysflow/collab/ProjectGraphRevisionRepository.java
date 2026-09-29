package dev.sysflow.collab;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProjectGraphRevisionRepository extends JpaRepository<ProjectGraphRevision, UUID> {
    Optional<ProjectGraphRevision> findByProjectIdAndRevision(UUID projectId, long revision);

    void deleteByProjectIdAndRevisionLessThan(UUID projectId, long revision);

    void deleteByProjectId(UUID projectId);
}
