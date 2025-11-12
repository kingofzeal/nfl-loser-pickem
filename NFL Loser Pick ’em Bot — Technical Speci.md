NFL Loser Pick ’em Bot — Technical Specification

1. Game Rules
- Each player picks one NFL team per week they believe will lose.
- Picks lock at scheduled kickoff time.
- Unlimited changes allowed until kickoff.
- No team may be picked more than once per season.
- Outcomes:
- Picked team loses → player win.
- Picked team wins or ties → player loss.
- No pick → bot assigns a random winning team not previously used → loss.
- Standings tracked as W–L record.

2. Command Schema
Root Command: /nfl
Sub‑actions:
- /nfl pick TEAM → make/change weekly pick.
- /nfl my → personal season summary.
- /nfl board [week] → standings (season or specific week).
- /nfl help → rules and usage.
- /nfl admin <action> → restricted admin actions.
Admin Sub‑actions
- seed-season YEAR → load schedule.
- open-week N → manually open week.
- finalize-week N → force finalization.
- set-game GAMEID status=<...> score=<...> → override game data.
- reset-pick PLAYER WEEK → undo a pick.
- sync → refresh from data source.
- config → set channel, timezone, reminders.

3. Database Schema
Global Tables
- Teams: team_id, slug, name, conference, division.
- Seasons: season_id, year, weeks_count, state.
- Weeks: week_id, season_id, week_number, state, open_at, close_at.
- Games: game_id, week_id, home_team_id, away_team_id, kickoff_time, status, scores, winner_team_id.
Workspace‑Scoped Tables
- Workspaces: workspace_id, platform, name, announcement_channel_id, timezone.
- Players: player_id, workspace_id, platform_user_id, display_name.
- Picks: pick_id, week_id, player_id, team_id, source, locked_at.
- Standings: standing_id, season_id, player_id, wins, losses.
- AuditLog: log_id, workspace_id, actor_type, actor_id, action, payload, created_at.
Constraints:
- One pick per week per player.
- No repeat teams per season.
- Workspace isolation enforced.

4. Ephemeral Responses
Pick Confirmation
- Title: “Week N Pick Confirmed”
- Body: Selected team, status pending, change policy.
- Buttons: [Change Pick] [View My Season].
My Summary
- Title: “Player — Season Summary”
- Record: W–L.
- Week‑by‑week list with ✅/❌ outcomes.
- Footer: “Picks are private until week completion.”
Board
- Title: “Season Standings (Week N)”
- Sorted by record.
- Ephemeral only.
Help
- Rules list.
- Reminder schedule.

5. Public Weekly Summary Image
- Header: Season + Week.
- Table: Player  Record  Week 1 … Week N.
- Cells:
- Green = Win (picked loser).
- Red = Loss (picked winner/tie or assigned team).
- Assigned teams bolded.
- Footer legend + bot signature.
- Posted in announcement channel after finalization.

6. Scheduler Flow
- Season setup: Seed schedule.
- Week open: Auto Tuesday morning; announcement posted.
- Reminders: Friday + Sunday morning (workspace timezone, optional player override).
- Game lock: Enforced by kickoff timestamp.
- Finalization: When all games final → outcomes computed, standings updated.
- Public post: Weekly summary image + text.
- Admin overrides: Force open/finalize, reset picks, override games.

7. Data Source Integration
- Seed schedule once per season (static JSON/CSV or API).
- Poll scoreboard feed hourly during game windows.
- Update Games table with status/scores.
- Kickoff times drive pick locking.
- Admin overrides handle anomalies.
- Audit log records all syncs and recalculations.

8. Ingestion Module
- Fetch: ESPN/TheSportsDB JSON.
- Normalize: Map external IDs → internal tables.
- Store: Upsert into Games.
- Trigger: Lock picks at kickoff, recalc outcomes at final.
- Error handling: Retry, cache, admin override.
- Audit: Log syncs and recalculations.

9. Services Layer
- PickService: validate/change/lock picks, assign random team.
- WeekService: manage lifecycle, reminders, finalization.
- StandingsService: compute outcomes, update records, generate leaderboard.
- GameService: sync/update games, trigger recalculation.
- AuditService: log all actions (player, admin, system).
- RenderService: generate ephemeral embeds/blocks and weekly summary image.

10. Design Principles
- Workspace isolation.
- Ephemeral responses for privacy.
- Public posts only for week open/finalization.
- Kickoff‑based locking (not feed status).
- Audit trail for all actions.
- Low‑cost, serverless, maintainable.

This document is ready to drop into GitHub Copilot as a scaffold. It gives you the rules, schema, flows, and service contracts so Copilot can start generating code against a clear design.
