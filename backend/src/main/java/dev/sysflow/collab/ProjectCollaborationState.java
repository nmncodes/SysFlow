package dev.sysflow.collab;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

/** Current canonical live graph and revision, shared by every backend instance. */
@Entity
@Table(name = "project_collaboration_state")
public class ProjectCollaborationState {

    @Id
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false)
    private long revision;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", nullable = false)
    private String graphJson;

    protected ProjectCollaborationState() {
    }

    public ProjectCollaborationState(UUID projectId, long revision, String graphJson) {
        this.projectId = projectId;
        this.revision = revision;
        this.graphJson = graphJson;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public long getRevision() {
        return revision;
    }

    public void setRevision(long revision) {
        this.revision = revision;
    }

    public String getGraphJson() {
        return graphJson;
    }

    public void setGraphJson(String graphJson) {
        this.graphJson = graphJson;
    }
}
