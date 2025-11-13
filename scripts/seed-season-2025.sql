-- Seed 2025 Season with 18 weeks
-- Run with: wrangler d1 execute nfl-loser-pickem-db --local --file=./scripts/seed-season-2025.sql
-- Or remote: wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-season-2025.sql

-- Create 2025 season
INSERT INTO seasons (year, weeks_count, state) VALUES (2025, 18, 'upcoming');

-- Get the season_id (SQLite last_insert_rowid())
-- Note: In a real script, you'd need to get this value and use it below
-- For now, assuming season_id = 1 (adjust if needed)

-- Create 18 weeks (approximate dates - adjust as needed for actual NFL schedule)
INSERT INTO weeks (season_id, week_number, state, open_at, close_at) VALUES
  (1, 1, 'scheduled', '2025-09-04 12:00:00', '2025-09-08 20:00:00'),
  (1, 2, 'scheduled', '2025-09-11 12:00:00', '2025-09-15 20:00:00'),
  (1, 3, 'scheduled', '2025-09-18 12:00:00', '2025-09-22 20:00:00'),
  (1, 4, 'scheduled', '2025-09-25 12:00:00', '2025-09-29 20:00:00'),
  (1, 5, 'scheduled', '2025-10-02 12:00:00', '2025-10-06 20:00:00'),
  (1, 6, 'scheduled', '2025-10-09 12:00:00', '2025-10-13 20:00:00'),
  (1, 7, 'scheduled', '2025-10-16 12:00:00', '2025-10-20 20:00:00'),
  (1, 8, 'scheduled', '2025-10-23 12:00:00', '2025-10-27 20:00:00'),
  (1, 9, 'scheduled', '2025-10-30 12:00:00', '2025-11-03 20:00:00'),
  (1, 10, 'scheduled', '2025-11-06 12:00:00', '2025-11-10 20:00:00'),
  (1, 11, 'scheduled', '2025-11-13 12:00:00', '2025-11-17 20:00:00'),
  (1, 12, 'scheduled', '2025-11-20 12:00:00', '2025-11-24 20:00:00'),
  (1, 13, 'scheduled', '2025-11-27 12:00:00', '2025-12-01 20:00:00'),
  (1, 14, 'scheduled', '2025-12-04 12:00:00', '2025-12-08 20:00:00'),
  (1, 15, 'scheduled', '2025-12-11 12:00:00', '2025-12-15 20:00:00'),
  (1, 16, 'scheduled', '2025-12-18 12:00:00', '2025-12-22 20:00:00'),
  (1, 17, 'scheduled', '2025-12-25 12:00:00', '2025-12-29 20:00:00'),
  (1, 18, 'scheduled', '2026-01-01 12:00:00', '2026-01-05 20:00:00');
