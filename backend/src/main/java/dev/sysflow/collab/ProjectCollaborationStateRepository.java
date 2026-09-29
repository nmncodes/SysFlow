package dev.sysflow.collab;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProjectCollaborationStateRepository extends JpaRepository<ProjectCollaborationState, UUID> {
}
