-- Create picks table (workspace-scoped)
CREATE TABLE picks (
  pick_id SERIAL PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES weeks(week_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(team_id),
  source VARCHAR(20) NOT NULL CHECK (source IN ('manual', 'auto_assigned')),
  locked_at TIMESTAMP NULL,
  outcome VARCHAR(20) NULL CHECK (outcome IN ('win', 'loss')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE (week_id, player_id)
);

CREATE INDEX idx_picks_week ON picks(week_id);
CREATE INDEX idx_picks_player ON picks(player_id);
CREATE INDEX idx_picks_team ON picks(team_id);

-- Trigger to update updated_at on picks
CREATE OR REPLACE FUNCTION update_picks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_picks_updated_at
  BEFORE UPDATE ON picks
  FOR EACH ROW
  EXECUTE FUNCTION update_picks_updated_at();

-- Create standings table (workspace-scoped)
CREATE TABLE standings (
  standing_id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  UNIQUE (season_id, player_id)
);

CREATE INDEX idx_standings_season ON standings(season_id);
CREATE INDEX idx_standings_player ON standings(player_id);

-- Function to enforce no repeat teams per player per season
CREATE OR REPLACE FUNCTION check_no_repeat_teams()
RETURNS TRIGGER AS $$
DECLARE
  team_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO team_count
  FROM picks p
  JOIN weeks w ON p.week_id = w.week_id
  WHERE p.player_id = NEW.player_id
    AND w.season_id = (SELECT season_id FROM weeks WHERE week_id = NEW.week_id)
    AND p.team_id = NEW.team_id
    AND p.pick_id != COALESCE(NEW.pick_id, -1);
  
  IF team_count > 0 THEN
    RAISE EXCEPTION 'Player has already picked this team this season';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_no_repeat_teams
  BEFORE INSERT OR UPDATE ON picks
  FOR EACH ROW
  EXECUTE FUNCTION check_no_repeat_teams();

-- Function to validate team plays in the week
CREATE OR REPLACE FUNCTION check_team_plays_in_week()
RETURNS TRIGGER AS $$
DECLARE
  game_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO game_count
  FROM games g
  WHERE g.week_id = NEW.week_id
    AND (g.home_team_id = NEW.team_id OR g.away_team_id = NEW.team_id)
    AND g.status != 'cancelled';
  
  IF game_count = 0 THEN
    RAISE EXCEPTION 'Team does not play in this week';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_team_plays
  BEFORE INSERT OR UPDATE ON picks
  FOR EACH ROW
  EXECUTE FUNCTION check_team_plays_in_week();
