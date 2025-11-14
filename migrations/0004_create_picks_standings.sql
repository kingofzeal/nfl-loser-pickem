-- Create picks table (workspace-scoped)
--
-- Note: Removed database triggers - validation logic moved to PickService:
-- 1. update_picks_updated_at: PickService must set updated_at on UPDATE operations
-- 2. check_no_repeat_teams: PickService.submitPick() must validate no duplicate team per player per season
-- 3. check_team_plays_in_week: PickService.submitPick() must validate team plays in the week

CREATE TABLE picks (
  pick_id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(team_id),
  source TEXT NOT NULL CHECK (source IN ('manual', 'auto_assigned')),
  locked_at TEXT NULL,
  outcome TEXT NULL CHECK (outcome IN ('win', 'loss')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (week_id, player_id)
);

CREATE INDEX idx_picks_week ON picks(week_id);
CREATE INDEX idx_picks_player ON picks(player_id);
CREATE INDEX idx_picks_team ON picks(team_id);

-- Create standings table (workspace-scoped)
CREATE TABLE standings (
  standing_id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (season_id, player_id)
);

CREATE INDEX idx_standings_season ON standings(season_id);
CREATE INDEX idx_standings_player ON standings(player_id);
