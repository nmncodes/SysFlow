package dev.sysflow.project;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "node_comments")
public class NodeComment {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    /** The graph node id this comment is attached to — free-form, not a foreign key (nodes live inside project_json). */
    @Column(name = "node_id", nullable = false)
    private String nodeId;

    @Column(name = "author_name", nullable = false)
    private String authorName;

    @Column(nullable = false, length = 2000)
    private String text;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected NodeComment() {
    }

    public NodeComment(UUID projectId, String nodeId, String authorName, String text) {
        this.projectId = projectId;
        this.nodeId = nodeId;
        this.authorName = authorName;
        this.text = text;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getNodeId() {
        return nodeId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getText() {
        return text;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
