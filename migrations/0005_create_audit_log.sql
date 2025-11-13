-- Create audit_log table (workspace-scoped)
--
-- Note: payload is stored as TEXT (use JSON.parse/JSON.stringify in application)

CREATE TABLE audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('player', 'admin', 'system')),
  actor_id INTEGER NULL,
  action TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id INTEGER NULL,
  payload TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_workspace ON audit_log(workspace_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
