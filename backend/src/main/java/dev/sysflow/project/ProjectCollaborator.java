package dev.sysflow.project;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** A durable, account-based collaboration grant. The project owner is implicit and is not stored here. */
@Entity
@Table(name = "project_collaborators", uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "user_id"}))
public class ProjectCollaborator {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CollaboratorRole role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected ProjectCollaborator() {
    }

    public ProjectCollaborator(UUID projectId, UUID userId, CollaboratorRole role) {
        this.projectId = projectId;
        this.userId = userId;
        this.role = role;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
    public CollaboratorRole getRole() { return role; }
    public void setRole(CollaboratorRole role) { this.role = role; }
    public Instant getCreatedAt() { return createdAt; }
}
