# Scheduler Documentation

## Overview

The SchedulerService handles all automated tasks for the NFL Loser Pick'em bot, including week management, game synchronization, reminders, and standings updates.

## Architecture

### Service Dependencies

```
SchedulerService
├── IDatabase (for querying seasons, weeks, workspaces)
├── IWeekService (for opening/finalizing weeks)
└── IGameService (for syncing game data from ESPN)
```

### Cron Schedule

Configured in `wrangler.toml`:

| Frequency | Purpose | Description |
|-----------|---------|-------------|
| Every hour | Game sync | Updates scores from ESPN API |
| Every 15 min (Sunday) | Live tracking | Frequent updates during Sunday games |
| Every 15 min (Mon 6pm-11pm) | MNF tracking | Monday Night Football updates |
| Every 15 min (Thu 6pm-11pm) | TNF tracking | Thursday Night Football updates |

## Job Functions

### 1. `openWeeksIfNeeded()`

Opens weeks that are scheduled to open.

**Logic:**
- Finds all weeks in 'scheduled' state
- Checks if `open_at` timestamp is in the past
- Calls `WeekService.openWeek()` to open the week
- Logs each week opened

**Frequency:** Runs every time cron triggers (checks all weeks)

**Example:**
```typescript
// Week 1 scheduled to open Tuesday 9 AM
// Cron runs at 10 AM, detects open_at is past
// Opens week automatically
await schedulerService.openWeeksIfNeeded();
```

### 2. `sendReminders()`

Sends reminders to workspaces on Friday and Sunday.

**Logic:**
- Gets current day of week (UTC)
- Finds all workspaces
- For each workspace with `reminder_friday_enabled` or `reminder_sunday_enabled`:
  - Logs reminder sent (TODO: integrate with platform adapters)

**Frequency:** Runs every time cron triggers (checks day of week)

**TODO:** 
- Integrate with Discord/Slack adapters to send actual messages
- Include current week info and deadline in message

### 3. `syncGames()`

Syncs game scores from ESPN API for active weeks.

**Logic:**
- Finds current season
- Gets all weeks in 'open' or 'in_progress' state
- Calls `GameService.syncGames()` for each week
- Updates game statuses and scores

**Frequency:** 
- Hourly during weekdays
- Every 15 minutes during game days (Thu/Sun/Mon)

**API:**
```typescript
// GameService.syncGames() calls:
// https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=X
```

### 4. `finalizeWeeksIfNeeded()`

Finalizes weeks when all games are complete.

**Logic:**
- Finds all weeks in 'open' or 'in_progress' state
- Checks if `close_at` timestamp is past
- Verifies all games are in 'final' or 'cancelled' status
- Calls `WeekService.finalizeWeek()` which:
  - Processes missing picks (auto-assign)
  - Updates pick outcomes based on game results
  - Updates standings
  - Logs finalization

**Frequency:** Runs every time cron triggers (checks all weeks)

**Example:**
```typescript
// Monday Night Football ends around 11 PM EST
// Cron runs Tuesday 4 AM UTC (11 PM Monday EST)
// All games final, week finalized automatically
await schedulerService.finalizeWeeksIfNeeded();
```

## Cloudflare Workers Integration

### Entry Point

In `src/index.ts`:

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = new Database(getD1Database(env));
    const services = createServices(db);
    
    // Run all scheduled jobs
    await services.schedulerService.runScheduledJobs();
  }
}
```

### Cron Configuration

In `wrangler.toml`:

```toml
[[triggers.crons]]
cron = "0 * * * *"  # Every hour

[[triggers.crons]]
cron = "*/15 * * * SUN"  # Every 15 min on Sunday

[[triggers.crons]]
cron = "*/15 18-23 * * MON"  # Every 15 min Mon 6pm-11pm UTC

[[triggers.crons]]
cron = "*/15 18-23 * * THU"  # Every 15 min Thu 6pm-11pm UTC
```

## Error Handling

### Graceful Degradation

All jobs catch errors and log them without throwing:

```typescript
async runScheduledJobs(): Promise<void> {
  try {
    await this.openWeeksIfNeeded();
    await this.sendReminders();
    await this.syncGames();
    await this.finalizeWeeksIfNeeded();
  } catch (error) {
    logger.error('Scheduler jobs failed', { error });
    // Don't throw - allow Workers to retry if needed
  }
}
```

### Individual Job Errors

Each job function logs errors but continues:

```typescript
for (const week of weeks) {
  try {
    await this.weekService.openWeek(week.week_id);
  } catch (error) {
    logger.error('Failed to open week', { week_id: week.week_id, error });
    // Continue with other weeks
  }
}
```

## Timezone Handling

### UTC-Based Scheduling

All cron triggers use UTC time. Workspaces store timezone preferences for display purposes only.

### Game Times

Game kickoff times are stored in UTC. The scheduler:
1. Fetches games from ESPN (times in UTC)
2. Stores in database as UTC
3. Checks if game has kicked off by comparing UTC times

### Week Open/Close Times

Week `open_at` and `close_at` timestamps are stored in UTC:

```typescript
// Week opens Tuesday 9 AM EST = Tuesday 2 PM UTC (during DST)
open_at: new Date('2025-09-09T14:00:00Z')

// Week closes Monday 11:30 PM EST = Tuesday 4:30 AM UTC
close_at: new Date('2025-09-16T04:30:00Z')
```

## Testing

### Integration Tests

Located in `tests/integration/scheduler.test.ts`:

```typescript
describe('SchedulerService Integration Tests', () => {
  it('should open weeks that are scheduled and past open_at time');
  it('should not open weeks with future open_at time');
  it('should sync games for open and in_progress weeks');
  it('should finalize weeks when all games are complete');
  it('should not finalize weeks if games are not complete');
  it('should run all scheduled jobs without error');
});
```

### Manual Testing

```bash
# Test scheduler locally
wrangler dev --local

# Trigger scheduled event manually
curl -X POST http://localhost:8787/__scheduled

# Check logs
wrangler tail
```

## Monitoring

### Cloudflare Dashboard

View cron execution history:
1. Go to Workers & Pages
2. Select your worker
3. Click "Triggers" tab
4. View "Cron Triggers" section

### Audit Logs

All scheduler actions are logged to `audit_log` table:

```typescript
await auditService.log({
  workspace_id: workspace.workspace_id,
  actor_type: 'system',
  action: 'week_opened',
  entity_type: 'week',
  entity_id: weekId,
  payload: { week_number, triggered_by: 'scheduler' }
});
```

Query audit logs:

```sql
SELECT * FROM audit_log 
WHERE actor_type = 'system' 
ORDER BY created_at DESC 
LIMIT 100;
```

## Future Enhancements

### Dynamic Cron Scheduling

Currently, cron schedules are static in `wrangler.toml`. Future enhancements:

1. **Per-workspace schedules**: Allow admins to set custom reminder times
2. **Dynamic game tracking**: Only run frequent syncs when games are actually in progress
3. **Adaptive polling**: Increase frequency when games are close, decrease when games are finalized

### Reminder Improvements

1. **Platform integration**: Actually send Discord/Slack messages
2. **Custom messages**: Include week number, deadline, available teams
3. **Per-player reminders**: DM players who haven't made picks
4. **Configurable times**: Let admins set reminder times per workspace

### Smart Finalization

1. **Early finalization**: Finalize week as soon as last game ends (not wait for close_at)
2. **Partial finalization**: Update standings incrementally as games finish
3. **Rollback support**: Handle score corrections after finalization

## Troubleshooting

### Week not opening automatically

**Check:**
1. `open_at` timestamp is in the past (UTC)
2. Week state is 'scheduled'
3. Cron trigger is configured in `wrangler.toml`
4. Check audit logs for errors

**Fix:**
```sql
-- Manually open week
UPDATE weeks SET state = 'open', open_at = datetime('now') WHERE week_id = ?;
```

### Games not syncing

**Check:**
1. ESPN API is accessible
2. Week state is 'open' or 'in_progress'
3. Team mappings are correct in `team-mappings.ts`

**Manual sync:**
```typescript
// Call from admin command
await gameService.syncGames(weekId);
```

### Week not finalizing

**Check:**
1. All games are in 'final' or 'cancelled' status
2. `close_at` timestamp is in the past
3. Week state is 'in_progress' or 'open'

**Manual finalization:**
```typescript
// Call from admin command
await weekService.finalizeWeek(weekId);
```

## References

- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [ESPN API Documentation](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
