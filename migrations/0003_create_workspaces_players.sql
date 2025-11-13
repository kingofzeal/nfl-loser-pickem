-- Create workspaces and players tables

-- Create workspaces table (workspace-scoped)
CREATE TABLE workspaces (
  workspace_id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'discord')),
  platform_workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  announcement_channel_id TEXT NULL,
  timezone TEXT DEFAULT 'America/New_York' NOT NULL,
  reminder_enabled INTEGER DEFAULT 1 NOT NULL, -- SQLite uses INTEGER for boolean (1=true, 0=false)
  reminder_friday_enabled INTEGER DEFAULT 1 NOT NULL,
  reminder_sunday_enabled INTEGER DEFAULT 1 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  UNIQUE (platform, platform_workspace_id)
);

CREATE INDEX idx_workspaces_platform_id ON workspaces(platform, platform_workspace_id);

-- Create players table (workspace-scoped)
CREATE TABLE players (
  player_id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0 NOT NULL, -- SQLite boolean as INTEGER
  joined_week_id INTEGER NULL REFERENCES weeks(week_id),
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  UNIQUE (workspace_id, platform_user_id)
);

CREATE INDEX idx_players_workspace ON players(workspace_id);
CREATE INDEX idx_players_platform_user ON players(workspace_id, platform_user_id);
