package dev.sysflow.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NodeCommentRepository extends JpaRepository<NodeComment, UUID> {
    List<NodeComment> findByProjectIdOrderByCreatedAtAsc(UUID projectId);

    void deleteByProjectId(UUID projectId);
}
