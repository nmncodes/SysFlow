package dev.sysflow.project;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * A snapshot of a project's graphJson taken just before it was overwritten,
 * so a save can be undone later. Phase 9 roadmap item — see docs/05-ROADMAP.md.
 * Pruned to the last MAX_VERSIONS_PER_PROJECT per project in ProjectController.
 */
@Entity
@Table(name = "project_versions")
public class ProjectVersion {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", nullable = false)
    private String graphJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected ProjectVersion() {
    }

    public ProjectVersion(UUID projectId, String graphJson) {
        this.projectId = projectId;
        this.graphJson = graphJson;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getGraphJson() {
        return graphJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
