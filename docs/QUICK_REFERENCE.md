# Quick Reference Guide

## Command Summary

### Player Commands
```
/nfl pick TEAM          # Make or change your weekly pick
/nfl my                 # View your season summary
/nfl board [week]       # View standings
/nfl help               # Show help message
```

### Admin Commands
```
/nfl admin seed-season YEAR              # Load season schedule
/nfl admin open-week N                   # Open week for picks
/nfl admin finalize-week N               # Force finalize a week
/nfl admin set-game ID status=... score=... # Override game data
/nfl admin reset-pick PLAYER WEEK        # Reset a player's pick
/nfl admin sync                          # Manual game data sync
/nfl admin config                        # Configure workspace settings
```

## Database Tables Reference

### Global (Shared)
- `teams` - 32 NFL teams
- `seasons` - Season records
- `weeks` - Week records (18 per season)
- `games` - Game schedule and results

### Workspace-Scoped
- `workspaces` - Slack/Discord workspaces
- `players` - Users in workspaces
- `picks` - Player picks per week
- `standings` - Season W-L records
- `audit_log` - Action history

## Key Rules

1. **Pick Deadline:** Game kickoff time (not week start)
2. **No Repeats:** Can't pick same team twice in a season
3. **Win Condition:** Picked team must LOSE
4. **Tie Handling:** Ties count as losses (configurable)
5. **No Pick:** Auto-assign random winning team = loss
6. **Privacy:** Picks hidden until week finalized

## State Machine

### Week States
- `scheduled` → `open` → `in_progress` → `finalized`

### Game States
- `scheduled` → `in_progress` → `final` (or `postponed`/`cancelled`)

### Pick States
- Created → Locked (at kickoff) → Outcome determined (win/loss)

## File Structure Quick Reference

```
src/
├── commands/      # /nfl command handlers
├── services/      # Business logic
├── types/         # TypeScript types
├── config/        # Configuration
└── utils/         # Helpers

migrations/        # SQL migrations
tests/            # Test suites
docs/             # Documentation
```

## Environment Variables Cheatsheet

```bash
# Required
DATABASE_URL=postgresql://...
SLACK_BOT_TOKEN=xoxb-...         # OR
DISCORD_BOT_TOKEN=...            # At least one required

# Optional
DATA_SOURCE=espn                 # or thesportsdb
DEFAULT_TIMEZONE=America/New_York
ENABLE_SCHEDULER=true
SYNC_INTERVAL_MINUTES=60
```

## Common npm Scripts

```bash
npm run dev              # Development server
npm run build            # Compile TypeScript
npm start                # Production server
npm test                 # Run tests
npm run migrate:up       # Run migrations
npm run migrate:down     # Rollback migration
npm run migrate:create NAME  # Create new migration
```

## Typical Week Flow

1. **Tuesday 9am:** Week auto-opens
2. **Tuesday-Sunday:** Players make/change picks
3. **Thursday-Monday:** Games kick off, picks lock individually
4. **After last game final:** Week auto-finalizes
5. **Finalization:** 
   - Missing picks assigned
   - Outcomes calculated
   - Standings updated
   - Public summary posted

## Development Workflow

1. Answer questions in `docs/DECISIONS.md`
2. Implement feature (follow interfaces in `services/interfaces/`)
3. Write tests
4. Run tests: `npm test`
5. Manual testing with bot
6. Deploy

## Useful Queries

### Get available teams for player
```sql
SELECT * FROM teams
WHERE team_id NOT IN (
  SELECT team_id FROM picks p
  JOIN weeks w ON p.week_id = w.week_id
  WHERE p.player_id = $1 AND w.season_id = $2
);
```

### Get standings
```sql
SELECT p.display_name, s.wins, s.losses
FROM standings s
JOIN players p ON s.player_id = p.player_id
WHERE s.season_id = $1 AND p.workspace_id = $2
ORDER BY s.wins DESC, s.losses ASC;
```

### Check if pick locked
```sql
SELECT EXISTS (
  SELECT 1 FROM games g
  WHERE (g.home_team_id = $1 OR g.away_team_id = $1)
    AND g.week_id = $2
    AND g.kickoff_time <= NOW()
);
```

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Bot not responding | Check bot token, verify webhook URL |
| Database errors | Verify DATABASE_URL, check connection |
| Games not syncing | Check ESPN API, verify cron running |
| TypeScript errors | Run `npm install`, check tsconfig.json |
| Tests failing | Check test database URL, run migrations |

## External Resources

- **ESPN API:** `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- **TheSportsDB:** `https://www.thesportsdb.com/api/v1/json/[KEY]/eventsseason.php?id=4391&s=2024`
- **Slack Bolt:** https://slack.dev/bolt-js/
- **Discord.js:** https://discord.js.org/

## Key Contacts / Links

- **Repo:** [Add your repo URL]
- **Issues:** [Add your issues URL]
- **Docs:** See `docs/` directory

---

**Last Updated:** [Auto-generated on scaffold creation]
