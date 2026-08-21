package dev.sysflow.project;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String description;

    /**
     * Raw JSON: { nodes: [...], edges: [...] } — see docs/04-DATA-MODEL-AND-API.md.
     * No hardcoded "jsonb" columnDefinition so the schema stays portable across
     * Postgres (prod) and H2 (tests) — Hibernate's JSON type still maps sensibly on both.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", nullable = false)
    private String graphJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /**
     * Opt-in only — the owner explicitly chooses to list this in the public gallery.
     * columnDefinition sets an explicit DEFAULT so ddl-auto=update's ALTER TABLE ADD COLUMN
     * backfills existing rows instead of violating the NOT NULL constraint on them.
     */
    @Column(name = "is_public_template", nullable = false, columnDefinition = "boolean default false")
    private boolean isPublicTemplate = false;

    protected Project() {
    }

    public Project(UUID userId, String name, String description, String graphJson) {
        this.userId = userId;
        this.name = name;
        this.description = description;
        this.graphJson = graphJson;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
        this.updatedAt = Instant.now();
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
        this.updatedAt = Instant.now();
    }

    public String getGraphJson() {
        return graphJson;
    }

    public void setGraphJson(String graphJson) {
        this.graphJson = graphJson;
        this.updatedAt = Instant.now();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isPublicTemplate() {
        return isPublicTemplate;
    }

    public void setPublicTemplate(boolean publicTemplate) {
        this.isPublicTemplate = publicTemplate;
        this.updatedAt = Instant.now();
    }
}
