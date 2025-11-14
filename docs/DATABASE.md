# Database Schema

## Overview

PostgreSQL database with two categories of tables:
- **Global tables**: Shared across all workspaces (teams, schedules)
- **Workspace-scoped tables**: Isolated per workspace (players, picks, standings)

## Entity Relationship Diagram

```
Global Domain:
┌─────────┐      ┌─────────┐      ┌────────┐      ┌────────┐
│ Teams   │◄─────│ Games   │─────►│ Weeks  │─────►│Seasons │
└─────────┘      └─────────┘      └────────┘      └────────┘
                      │
                      │
Workspace Domain:     │
┌───────────┐         │         ┌─────────┐
│Workspaces │         │         │ Players │
└─────┬─────┘         │         └────┬────┘
      │               │              │
      │         ┌─────▼──────┐       │
      │         │   Picks    │◄──────┘
      │         └─────┬──────┘
      │               │
      │         ┌─────▼──────┐
      └────────►│ Standings  │
                └────────────┘
```

## Global Tables

### `teams`
Stores all 32 NFL teams. Minimal immutable structure.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| team_id | INTEGER (AUTOINCREMENT) | PRIMARY KEY | Unique identifier |
| slug | TEXT | UNIQUE, NOT NULL | Stable identifier ("ravens") |
| name | TEXT | NOT NULL | Full display name |
| conference | TEXT | NOT NULL | AFC or NFC (CHECK) |
| division | TEXT | NOT NULL | North, South, East, West (CHECK) |

Removed legacy `city` and `abbreviation` fields—reduces redundancy; presentation handled by `name`.

**Indexes:**
- `idx_teams_slug` on `slug`

---

### `seasons`
Tracks NFL seasons.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| season_id | SERIAL | PRIMARY KEY | Unique identifier |
| year | INTEGER | UNIQUE, NOT NULL | Season year (e.g., 2024) |
| weeks_count | INTEGER | DEFAULT 18 | Number of weeks (regular season) |
| state | VARCHAR(20) | NOT NULL | upcoming, active, completed |

**Indexes:**
- `idx_seasons_year` on `year`

---

### `weeks`
Individual weeks within a season.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| week_id | SERIAL | PRIMARY KEY | Unique identifier |
| season_id | INTEGER | FOREIGN KEY → seasons.season_id | Parent season |
| week_number | INTEGER | NOT NULL | 1–18 |
| state | VARCHAR(20) | NOT NULL | scheduled, open, in_progress, finalized |
| open_at | TIMESTAMP | NULL | When week opens for picks |
| close_at | TIMESTAMP | NULL | Last game kickoff time |

**Constraints:**
- UNIQUE (season_id, week_number)

**Indexes:**
- `idx_weeks_season` on `season_id`
- `idx_weeks_state` on `state`

---

### `games`
Individual NFL games.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| game_id | SERIAL | PRIMARY KEY | Unique identifier |
| week_id | INTEGER | FOREIGN KEY → weeks.week_id | Parent week |
| home_team_id | INTEGER | FOREIGN KEY → teams.team_id | Home team |
| away_team_id | INTEGER | FOREIGN KEY → teams.team_id | Away team |
| kickoff_time | TIMESTAMP | NOT NULL | Scheduled kickoff (UTC) |
| status | VARCHAR(20) | NOT NULL | scheduled, in_progress, final, postponed |
| home_score | INTEGER | NULL | Final score (null until final) |
| away_score | INTEGER | NULL | Final score (null until final) |
| winner_team_id | INTEGER | NULL, FOREIGN KEY → teams.team_id | Winning team (null if tie) |
| external_id | VARCHAR(50) | NULL | ESPN/TheSportsDB game ID |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last sync time |
| (Manually set on UPDATE; no triggers in D1) |

**Indexes:**
- `idx_games_week` on `week_id`
- `idx_games_kickoff` on `kickoff_time`
- `idx_games_status` on `status`
- `idx_games_external` on `external_id`

---

## Workspace-Scoped Tables

### `workspaces`
Each Slack workspace or Discord server.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| workspace_id | SERIAL | PRIMARY KEY | Unique identifier |
| platform | VARCHAR(20) | NOT NULL | slack, discord |
| platform_workspace_id | VARCHAR(100) | NOT NULL | Slack team ID or Discord guild ID |
| name | VARCHAR(255) | NOT NULL | Human-readable name |
| announcement_channel_id | VARCHAR(100) | NULL | Where public posts go |
| timezone | VARCHAR(50) | DEFAULT 'America/New_York' | Workspace timezone |
| reminder_enabled | BOOLEAN | DEFAULT true | Send reminders |
| reminder_friday_enabled | BOOLEAN | DEFAULT true | Send Friday reminders |
| reminder_sunday_enabled | BOOLEAN | DEFAULT true | Send Sunday reminders |
| (Stored as INTEGER 1/0 in D1; coerced in code) |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- UNIQUE (platform, platform_workspace_id)

**Indexes:**
- `idx_workspaces_platform_id` on `(platform, platform_workspace_id)`

---

### `players`
Users within a workspace.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| player_id | SERIAL | PRIMARY KEY | Unique identifier |
| workspace_id | INTEGER | FOREIGN KEY → workspaces.workspace_id | Parent workspace |
| platform_user_id | VARCHAR(100) | NOT NULL | Slack user ID or Discord user ID |
| display_name | VARCHAR(100) | NOT NULL | Display name |
| is_admin | BOOLEAN | DEFAULT false | Admin privileges |
| joined_week_id | INTEGER | NULL, FOREIGN KEY → weeks.week_id | Week when player joined (for mid-season joins) |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Constraints:**
- UNIQUE (workspace_id, platform_user_id)

**Indexes:**
- `idx_players_workspace` on `workspace_id`
- `idx_players_platform_user` on `(workspace_id, platform_user_id)`

---

### `picks`
Player picks for each week.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| pick_id | SERIAL | PRIMARY KEY | Unique identifier |
| week_id | INTEGER | FOREIGN KEY → weeks.week_id | Week of pick |
| player_id | INTEGER | FOREIGN KEY → players.player_id | Who made the pick |
| team_id | INTEGER | FOREIGN KEY → teams.team_id | Team picked to lose |
| source | VARCHAR(20) | NOT NULL | manual, auto_assigned |
| locked_at | TIMESTAMP | NULL | When pick locked (at kickoff) |
| outcome | VARCHAR(20) | NULL | win, loss (null until finalized) |
| created_at | TIMESTAMP | DEFAULT NOW() | Original pick time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last change time |
| (Manually updated in application layer) |

**Constraints:**
- UNIQUE (week_id, player_id) — one pick per week
- CHECK (source IN ('manual', 'auto_assigned'))
- CHECK (outcome IN ('win', 'loss') OR outcome IS NULL)

**Indexes:**
- `idx_picks_week` on `week_id`
- `idx_picks_player` on `player_id`
- `idx_picks_team` on `team_id`

---

### `standings`
Season-long W–L records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| standing_id | SERIAL | PRIMARY KEY | Unique identifier |
| season_id | INTEGER | FOREIGN KEY → seasons.season_id | Season |
| player_id | INTEGER | FOREIGN KEY → players.player_id | Player |
| wins | INTEGER | DEFAULT 0 | Total wins |
| losses | INTEGER | DEFAULT 0 | Total losses |

**Constraints:**
- UNIQUE (season_id, player_id)

**Indexes:**
- `idx_standings_season` on `season_id`
- `idx_standings_player` on `player_id`

---

### `audit_log`
Audit trail for all actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| log_id | SERIAL | PRIMARY KEY | Unique identifier |
| workspace_id | INTEGER | FOREIGN KEY → workspaces.workspace_id | Workspace context |
| actor_type | VARCHAR(20) | NOT NULL | player, admin, system |
| actor_id | INTEGER | NULL | player_id if player/admin |
| action | VARCHAR(50) | NOT NULL | pick_created, week_finalized, game_synced, etc. |
| entity_type | VARCHAR(50) | NULL | pick, game, week, etc. |
| entity_id | INTEGER | NULL | ID of affected entity |
| payload | JSONB | NULL | Additional context |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_audit_workspace` on `workspace_id`
- `idx_audit_created` on `created_at`
- `idx_audit_action` on `action`

---

## Key Constraints & Business Rules

### No Repeat Teams
Enforced via query: `SELECT team_id FROM picks WHERE player_id = ? AND week_id IN (SELECT week_id FROM weeks WHERE season_id = ?)`

### One Pick Per Week
Enforced by UNIQUE constraint on `(week_id, player_id)` in `picks` table.

### Team Must Play in Week
Validated via service-layer query (D1 has no triggers). Pick rejected if team lacks scheduled (non-cancelled) game that week.

### Workspace Isolation
All queries for workspace-scoped tables MUST filter by `workspace_id` or join through `players` table.

### Pick Locking
Picks locked when `games.kickoff_time <= NOW()` for the game involving the picked team.

### Pick Unlocking (Postponements)
### Empty Week Finalization
Weeks with zero games are not considered finalized; prevents premature season rollover.
When a game is postponed and kickoff time updated, picks are automatically unlocked until the new kickoff time.

### Outcome Calculation
When week finalized:
```sql
UPDATE picks SET outcome = 
  CASE 
    WHEN games.winner_team_id IS NOT NULL AND games.winner_team_id != picks.team_id THEN 'win'
    ELSE 'loss'  -- Includes ties (winner_team_id IS NULL)
  END
WHERE week_id = ?;
```

### Mid-Season Joins
Players can join mid-season. `joined_week_id` tracks when they joined. Standings only count weeks after join (no penalties for missed weeks).

---

## Migration Strategy

Migrations stored in `migrations/` directory, numbered sequentially:
- `001_create_teams.sql`
- `002_create_seasons_weeks_games.sql`
- `003_create_workspaces_players.sql`
- `004_create_picks_standings.sql`
- `005_create_audit_log.sql`
- `006_add_indexes.sql`
- `007_seed_teams.sql`

- `006_add_indexes.sql`
- `007_add_archive_tracking.sql`

Executed via Wrangler D1 migrations; timestamps stored as TEXT (ISO). UPDATE statements set `updated_at` explicitly.

---

## Archive Strategy

After a season completes, data can be exported and purged to keep the database lean:

1. **Export season data** to JSON/CSV format
2. **Purge workspace-specific data** (picks, standings, audit logs for that season)
3. **Keep global data** (teams, seasons, weeks, games for reference)
4. **Store exports** in `./archives/` directory or S3

This keeps the active database small while preserving historical records.

---

## Sample Queries

### Get available teams for player
```sql
SELECT t.* FROM teams t
WHERE t.team_id NOT IN (
  SELECT p.team_id FROM picks p
  JOIN weeks w ON p.week_id = w.week_id
  WHERE p.player_id = $1 AND w.season_id = $2
);
```

### Check if pick is locked
```sql
SELECT EXISTS (
  SELECT 1 FROM games g
  WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
    AND g.week_id = $2
    AND g.kickoff_time <= NOW()
) AS is_locked;
```

### Get standings for season
```sql
SELECT p.display_name, s.wins, s.losses
FROM standings s
JOIN players p ON s.player_id = p.player_id
WHERE s.season_id = $1 AND p.workspace_id = $2
ORDER BY s.wins DESC, s.losses ASC;
```

### Get player's season summary
```sql
SELECT w.week_number, t.name, p.outcome, p.source
FROM picks p
JOIN weeks w ON p.week_id = w.week_id
JOIN teams t ON p.team_id = t.team_id
WHERE p.player_id = $1 AND w.season_id = $2
ORDER BY w.week_number;
```
