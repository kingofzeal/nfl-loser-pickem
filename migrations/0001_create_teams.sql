-- Create teams table (uses SQLite/Cloudflare D1)

-- Create teams table (global, shared across all workspaces)
CREATE TABLE teams (
  team_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('AFC', 'NFC')),
  division TEXT NOT NULL CHECK (division IN ('North', 'South', 'East', 'West'))
);

-- Create index on slug for fast lookups
CREATE INDEX idx_teams_slug ON teams(slug);

-- Insert all 32 NFL teams
INSERT INTO teams (slug, name, conference, division) VALUES
  ('cardinals', 'Arizona Cardinals', 'NFC', 'West'),
  ('falcons', 'Atlanta Falcons', 'NFC', 'South'),
  ('ravens', 'Baltimore Ravens', 'AFC', 'North'),
  ('bills', 'Buffalo Bills', 'AFC', 'East'),
  ('panthers', 'Carolina Panthers', 'NFC', 'South'),
  ('bears', 'Chicago Bears', 'NFC', 'North'),
  ('bengals', 'Cincinnati Bengals', 'AFC', 'North'),
  ('browns', 'Cleveland Browns', 'AFC', 'North'),
  ('cowboys', 'Dallas Cowboys', 'NFC', 'East'),
  ('broncos', 'Denver Broncos', 'AFC', 'West'),
  ('lions', 'Detroit Lions', 'NFC', 'North'),
  ('packers', 'Green Bay Packers', 'NFC', 'North'),
  ('texans', 'Houston Texans', 'AFC', 'South'),
  ('colts', 'Indianapolis Colts', 'AFC', 'South'),
  ('jaguars', 'Jacksonville Jaguars', 'AFC', 'South'),
  ('chiefs', 'Kansas City Chiefs', 'AFC', 'West'),
  ('raiders', 'Las Vegas Raiders', 'AFC', 'West'),
  ('chargers', 'Los Angeles Chargers', 'AFC', 'West'),
  ('rams', 'Los Angeles Rams', 'NFC', 'West'),
  ('dolphins', 'Miami Dolphins', 'AFC', 'East'),
  ('vikings', 'Minnesota Vikings', 'NFC', 'North'),
  ('patriots', 'New England Patriots', 'AFC', 'East'),
  ('saints', 'New Orleans Saints', 'NFC', 'South'),
  ('giants', 'New York Giants', 'NFC', 'East'),
  ('jets', 'New York Jets', 'AFC', 'East'),
  ('eagles', 'Philadelphia Eagles', 'NFC', 'East'),
  ('steelers', 'Pittsburgh Steelers', 'AFC', 'North'),
  ('49ers', 'San Francisco 49ers', 'NFC', 'West'),
  ('seahawks', 'Seattle Seahawks', 'NFC', 'West'),
  ('buccaneers', 'Tampa Bay Buccaneers', 'NFC', 'South'),
  ('titans', 'Tennessee Titans', 'AFC', 'South'),
  ('commanders', 'Washington Commanders', 'NFC', 'East');
