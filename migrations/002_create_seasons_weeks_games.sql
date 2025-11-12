-- Create seasons table (global)
CREATE TABLE seasons (
  season_id SERIAL PRIMARY KEY,
  year INTEGER UNIQUE NOT NULL,
  weeks_count INTEGER DEFAULT 18 NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (state IN ('upcoming', 'active', 'completed'))
);

CREATE INDEX idx_seasons_year ON seasons(year);

-- Create weeks table (global)
CREATE TABLE weeks (
  week_id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 18),
  state VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'open', 'in_progress', 'finalized')),
  open_at TIMESTAMP NULL,
  close_at TIMESTAMP NULL,
  UNIQUE (season_id, week_number)
);

CREATE INDEX idx_weeks_season ON weeks(season_id);
CREATE INDEX idx_weeks_state ON weeks(state);

-- Create games table (global)
CREATE TABLE games (
  game_id SERIAL PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
  kickoff_time TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')),
  home_score INTEGER NULL,
  away_score INTEGER NULL,
  winner_team_id INTEGER NULL REFERENCES teams(team_id),
  external_id VARCHAR(50) NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (home_team_id != away_team_id),
  CHECK (winner_team_id IS NULL OR winner_team_id IN (home_team_id, away_team_id))
);

CREATE INDEX idx_games_week ON games(week_id);
CREATE INDEX idx_games_kickoff ON games(kickoff_time);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_external ON games(external_id);

-- Trigger to update updated_at on games
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_games_updated_at();
