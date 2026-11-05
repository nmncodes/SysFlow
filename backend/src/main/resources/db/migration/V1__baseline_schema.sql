-- Baseline schema for SysFlow, generated from JPA entities.
-- Flyway will skip this if the tables already exist (baseline-on-migrate).

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    created_at      TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         VARCHAR(255),
    graph_json          TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,
    is_public_template  BOOLEAN NOT NULL DEFAULT FALSE,
    share_token         UUID UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

CREATE TABLE IF NOT EXISTS project_collaborators (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL,
    user_id     UUID NOT NULL,
    role        VARCHAR(16) NOT NULL,
    created_at  TIMESTAMP NOT NULL,
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user ON project_collaborators(user_id);

CREATE TABLE IF NOT EXISTS project_versions (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL,
    graph_json  TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);

CREATE TABLE IF NOT EXISTS node_comments (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL,
    node_id     VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    text        VARCHAR(2000) NOT NULL,
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_node_comments_project ON node_comments(project_id);

CREATE TABLE IF NOT EXISTS project_collaboration_state (
    project_id  UUID PRIMARY KEY,
    revision    BIGINT NOT NULL,
    graph_json  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_graph_revisions (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL,
    revision    BIGINT NOT NULL,
    graph_json  TEXT NOT NULL,
    UNIQUE (project_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_graph_revisions_project ON project_graph_revisions(project_id);

-- Clean orphaned rows before adding FK constraints.
-- Order: purge parent orphans first, then child orphans created by the purge.
DELETE FROM project_graph_revisions WHERE project_id IN (SELECT id FROM projects WHERE user_id NOT IN (SELECT id FROM users));
DELETE FROM node_comments            WHERE project_id IN (SELECT id FROM projects WHERE user_id NOT IN (SELECT id FROM users));
DELETE FROM project_versions         WHERE project_id IN (SELECT id FROM projects WHERE user_id NOT IN (SELECT id FROM users));
DELETE FROM project_collaborators    WHERE project_id IN (SELECT id FROM projects WHERE user_id NOT IN (SELECT id FROM users));
DELETE FROM projects WHERE user_id NOT IN (SELECT id FROM users);

DELETE FROM project_graph_revisions WHERE project_id NOT IN (SELECT id FROM projects);
DELETE FROM node_comments WHERE project_id NOT IN (SELECT id FROM projects);
DELETE FROM project_versions WHERE project_id NOT IN (SELECT id FROM projects);
DELETE FROM project_collaborators WHERE project_id NOT IN (SELECT id FROM projects);
DELETE FROM project_collaborators WHERE user_id NOT IN (SELECT id FROM users);

-- Foreign keys — use DO blocks for idempotency on PostgreSQL < 17
DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT fk_projects_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_collaborators ADD CONSTRAINT fk_collab_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_collaborators ADD CONSTRAINT fk_collab_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_versions ADD CONSTRAINT fk_versions_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE node_comments ADD CONSTRAINT fk_comments_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_graph_revisions ADD CONSTRAINT fk_revisions_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
