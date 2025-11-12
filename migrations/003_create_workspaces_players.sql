-- Create workspaces table (workspace-scoped)
CREATE TABLE workspaces (
  workspace_id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('slack', 'discord')),
  platform_workspace_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  announcement_channel_id VARCHAR(100) NULL,
  timezone VARCHAR(50) DEFAULT 'America/New_York' NOT NULL,
  reminder_enabled BOOLEAN DEFAULT true NOT NULL,
  reminder_friday_enabled BOOLEAN DEFAULT true NOT NULL,
  reminder_sunday_enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE (platform, platform_workspace_id)
);

CREATE INDEX idx_workspaces_platform_id ON workspaces(platform, platform_workspace_id);

-- Create players table (workspace-scoped)
CREATE TABLE players (
  player_id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  platform_user_id VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  joined_week_id INTEGER NULL REFERENCES weeks(week_id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, platform_user_id)
);

CREATE INDEX idx_players_workspace ON players(workspace_id);
CREATE INDEX idx_players_platform_user ON players(workspace_id, platform_user_id);
