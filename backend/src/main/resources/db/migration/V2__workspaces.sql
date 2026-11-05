CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(64) NOT NULL UNIQUE,
    owner_id    UUID NOT NULL,
    created_at  TIMESTAMP NOT NULL,
    plan        VARCHAR(32) NOT NULL DEFAULT 'free'
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
    id            UUID PRIMARY KEY,
    workspace_id  UUID NOT NULL,
    user_id       UUID NOT NULL,
    role          VARCHAR(16) NOT NULL,
    joined_at     TIMESTAMP NOT NULL,
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID;
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

DO $$ BEGIN
  ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD CONSTRAINT fk_wm_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members ADD CONSTRAINT fk_wm_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
