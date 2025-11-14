-- Create seasons, weeks, and games tables

-- Create seasons table (global)
CREATE TABLE seasons (
  season_id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER UNIQUE NOT NULL,
  weeks_count INTEGER DEFAULT 18 NOT NULL,
  state TEXT NOT NULL DEFAULT 'upcoming' CHECK (state IN ('upcoming', 'active', 'completed')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_seasons_year ON seasons(year);

-- Create weeks table (global)
CREATE TABLE weeks (
  week_id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 18),
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'open', 'in_progress', 'finalized')),
  open_at TEXT NULL, -- SQLite uses TEXT for timestamps (ISO 8601 format)
  close_at TEXT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (season_id, week_number)
);

CREATE INDEX idx_weeks_season ON weeks(season_id);
CREATE INDEX idx_weeks_state ON weeks(state);

-- Create games table (global)
CREATE TABLE games (
  game_id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  kickoff_time TEXT NOT NULL, -- SQLite uses TEXT for timestamps
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')),
  home_score INTEGER NULL,
  away_score INTEGER NULL,
  winner_team_id INTEGER NULL REFERENCES teams(team_id),
  external_id TEXT NULL,
  updated_at TEXT DEFAULT (datetime('now')), -- SQLite datetime function
  CHECK (home_team_id != away_team_id),
  CHECK (winner_team_id IS NULL OR winner_team_id = home_team_id OR winner_team_id = away_team_id)
);

CREATE INDEX idx_games_week ON games(week_id);
CREATE INDEX idx_games_kickoff ON games(kickoff_time);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_external ON games(external_id);

-- Note: SQLite doesn't support triggers in the same way as PostgreSQL
-- The updated_at field uses a default datetime, but won't auto-update on UPDATE
-- We'll handle this in the application layer (Database.ts)
