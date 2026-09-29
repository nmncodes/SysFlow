package dev.sysflow.collab;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

/** Durable merge base retained for one live graph revision. */
@Entity
@Table(name = "project_graph_revisions", uniqueConstraints =
        @UniqueConstraint(name = "uk_project_graph_revision", columnNames = {"project_id", "revision"}))
public class ProjectGraphRevision {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false)
    private long revision;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", nullable = false)
    private String graphJson;

    protected ProjectGraphRevision() {
    }

    public ProjectGraphRevision(UUID projectId, long revision, String graphJson) {
        this.projectId = projectId;
        this.revision = revision;
        this.graphJson = graphJson;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public long getRevision() {
        return revision;
    }

    public String getGraphJson() {
        return graphJson;
    }
}
