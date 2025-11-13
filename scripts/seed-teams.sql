-- Seed NFL Teams
-- Run with: wrangler d1 execute nfl-loser-pickem-db --local --file=./scripts/seed-teams.sql
-- Or remote: wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql

-- AFC East
INSERT INTO teams (slug, name, conference, division) VALUES
  ('bills', 'Buffalo Bills', 'AFC', 'East'),
  ('dolphins', 'Miami Dolphins', 'AFC', 'East'),
  ('patriots', 'New England Patriots', 'AFC', 'East'),
  ('jets', 'New York Jets', 'AFC', 'East');

-- AFC North
INSERT INTO teams (slug, name, conference, division) VALUES
  ('ravens', 'Baltimore Ravens', 'AFC', 'North'),
  ('bengals', 'Cincinnati Bengals', 'AFC', 'North'),
  ('browns', 'Cleveland Browns', 'AFC', 'North'),
  ('steelers', 'Pittsburgh Steelers', 'AFC', 'North');

-- AFC South
INSERT INTO teams (slug, name, conference, division) VALUES
  ('texans', 'Houston Texans', 'AFC', 'South'),
  ('colts', 'Indianapolis Colts', 'AFC', 'South'),
  ('jaguars', 'Jacksonville Jaguars', 'AFC', 'South'),
  ('titans', 'Tennessee Titans', 'AFC', 'South');

-- AFC West
INSERT INTO teams (slug, name, conference, division) VALUES
  ('broncos', 'Denver Broncos', 'AFC', 'West'),
  ('chiefs', 'Kansas City Chiefs', 'AFC', 'West'),
  ('raiders', 'Las Vegas Raiders', 'AFC', 'West'),
  ('chargers', 'Los Angeles Chargers', 'AFC', 'West');

-- NFC East
INSERT INTO teams (slug, name, conference, division) VALUES
  ('cowboys', 'Dallas Cowboys', 'NFC', 'East'),
  ('giants', 'New York Giants', 'NFC', 'East'),
  ('eagles', 'Philadelphia Eagles', 'NFC', 'East'),
  ('commanders', 'Washington Commanders', 'NFC', 'East');

-- NFC North
INSERT INTO teams (slug, name, conference, division) VALUES
  ('bears', 'Chicago Bears', 'NFC', 'North'),
  ('lions', 'Detroit Lions', 'NFC', 'North'),
  ('packers', 'Green Bay Packers', 'NFC', 'North'),
  ('vikings', 'Minnesota Vikings', 'NFC', 'North');

-- NFC South
INSERT INTO teams (slug, name, conference, division) VALUES
  ('falcons', 'Atlanta Falcons', 'NFC', 'South'),
  ('panthers', 'Carolina Panthers', 'NFC', 'South'),
  ('saints', 'New Orleans Saints', 'NFC', 'South'),
  ('buccaneers', 'Tampa Bay Buccaneers', 'NFC', 'South');

-- NFC West
INSERT INTO teams (slug, name, conference, division) VALUES
  ('cardinals', 'Arizona Cardinals', 'NFC', 'West'),
  ('rams', 'Los Angeles Rams', 'NFC', 'West'),
  ('49ers', 'San Francisco 49ers', 'NFC', 'West'),
  ('seahawks', 'Seattle Seahawks', 'NFC', 'West');
