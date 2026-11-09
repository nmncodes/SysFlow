package dev.sysflow.workspace;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workspaces")
public class Workspace {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private String plan = "free";

    protected Workspace() {}

    public Workspace(String name, String slug, UUID ownerId) {
        this.name = name;
        this.slug = slug;
        this.ownerId = ownerId;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public UUID getOwnerId() { return ownerId; }
    public Instant getCreatedAt() { return createdAt; }
    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
}
