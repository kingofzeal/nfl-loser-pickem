# Data Ingestion - ESPN API Integration

This document covers the implementation of live NFL game data ingestion from ESPN's API.

## Overview

The bot uses ESPN's publicly available API to fetch NFL game schedules and live scores. The `GameService` handles all ESPN integration with retry logic, error handling, and data validation.

## ESPN API

### Base URL
```
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
```

### Query Parameters
- `week=<number>` - Week number (1-18 for regular season)
- `seasontype=2` - Regular season (1=preseason, 3=playoffs)
- `limit=100` - Maximum number of games to return

### Rate Limiting
- ESPN doesn't publish official rate limits
- Implementation uses 1 request per second with exponential backoff
- Handles 429 (Too Many Requests) responses automatically

## Implementation

### GameService Configuration

```typescript
class GameService {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly REQUEST_TIMEOUT_MS = 10000;
}
```

### Retry Logic

The service includes comprehensive retry logic:

1. **Exponential Backoff**: Delays increase with each retry (1s, 2s, 4s)
2. **Rate Limit Handling**: Respects `Retry-After` header from 429 responses
3. **Timeout Protection**: 10-second timeout per request
4. **Server Error Retry**: Automatically retries on 5xx errors
5. **Client Error Skip**: No retry on 4xx errors (except 429)

```typescript
private async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) return response;
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : this.RETRY_DELAY_MS * Math.pow(2, attempt);
        await this.sleep(delayMs);
        continue;
      }
      
      // Retry server errors
      if (response.status >= 500 && attempt < retries) {
        await this.sleep(this.RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      
      throw new Error(`ESPN API request failed: ${response.status}`);
    } catch (error) {
      if (attempt === retries) throw error;
      await this.sleep(this.RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }
}
```

## Data Validation

### Game Processing

Every ESPN game goes through comprehensive validation:

1. **Structure Validation**
   - Game ID must exist
   - Competition data must be present
   - Competitors array must be valid

2. **Team Validation**
   - Team IDs must be in ESPN_TEAM_MAP
   - Teams must exist in database
   - Home/away roles must be clear

3. **Status Validation**
   - Game status must be present
   - Status mapped to internal enum: `scheduled`, `in_progress`, `final`, `postponed`, `cancelled`

4. **Date/Time Validation**
   - Kickoff time must be valid ISO date
   - Date parsing validated with `isNaN()` check

5. **Score Validation**
   - Scores must be non-negative integers
   - Invalid scores logged and set to null
   - Winner determined only for final games with valid scores

### Team Mapping

Teams are mapped from ESPN IDs to internal slugs:

```typescript
export const ESPN_TEAM_MAP: Record<string, string> = {
  '1': 'falcons',
  '2': 'bills',
  '3': 'bears',
  // ... all 32 NFL teams
  '33': 'ravens',
  '34': 'texans',
};
```

If an unknown team ID is encountered, the game is skipped and logged.

## Error Handling

### Graceful Degradation

The service handles errors at multiple levels:

1. **Request Level**: Retry with exponential backoff
2. **Game Level**: Skip individual games with errors, continue processing others
3. **Sync Level**: Log aggregate results (success/error counts)

```typescript
async syncGames(weekId: number): Promise<void> {
  // ... fetch data
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const espnGame of data.events) {
    try {
      await this.processESPNGame(espnGame, weekId);
      successCount++;
    } catch (error) {
      errorCount++;
      // Continue processing
    }
  }
  
  // Throw only if all games failed
  if (errorCount > 0 && successCount === 0) {
    throw new Error('All games failed to sync');
  }
}
```

### Audit Logging

Every sync operation is logged to the audit log:

```typescript
await this.auditService.log({
  workspace_id: workspace.workspace_id,
  actor_type: 'system',
  action: 'games_synced',
  entity_type: 'week',
  entity_id: weekId,
  payload: {
    total: data.events.length,
    success: successCount,
    errors: errorCount,
  },
});
```

## Status Mapping

ESPN statuses are mapped to internal game states:

| ESPN Status | Internal Status | Description |
|-------------|----------------|-------------|
| STATUS_SCHEDULED, STATUS_PRE | `scheduled` | Game not yet started |
| STATUS_IN_PROGRESS, STATUS_HALFTIME | `in_progress` | Game currently being played |
| STATUS_FINAL | `final` | Game completed |
| STATUS_POSTPONED, STATUS_DELAYED | `postponed` | Game delayed |
| STATUS_CANCELLED | `cancelled` | Game cancelled |

Unknown statuses default to `in_progress` with a warning logged.

## Scheduled Sync

Games are synced automatically via Cloudflare Cron Triggers:

- **Hourly**: Base sync for all open/in_progress weeks
- **Every 15 minutes (Sunday)**: Live game tracking
- **Every 15 minutes (Thu/Mon 6-11pm UTC)**: TNF/MNF tracking

See `docs/SCHEDULER.md` for full cron configuration.

## Manual Sync

Admins can manually trigger game sync:

```
/nfl admin sync-games [week_number]
```

This bypasses the scheduler and immediately fetches latest data from ESPN.

## Testing

### Integration Tests

The `GameService` has comprehensive integration tests using better-sqlite3:

- **Fetch and create**: Tests creating new games from ESPN data
- **Update existing**: Tests updating games with new scores/status
- **Tie games**: Tests handling games with equal scores
- **API errors**: Tests error handling with mock failures
- **Unknown teams**: Tests skipping games with unmapped teams

Run tests:
```bash
npm test tests/integration/game-service.test.ts
```

### Mock Data

Sample ESPN responses are stored in `tests/fixtures/espn-scoreboard.md` for testing.

## Troubleshooting

### Sync Failures

Check audit log for sync errors:
```sql
SELECT * FROM audit_log 
WHERE action = 'games_synced' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Missing Games

If games aren't appearing after sync:
1. Check if week exists and is in correct state
2. Verify teams are seeded in database
3. Check ESPN API response structure hasn't changed
4. Review error logs for team mapping issues

### Invalid Scores

If scores appear incorrect:
1. Compare with ESPN website directly
2. Check audit log for game update events
3. Manually override with `/nfl admin set-game` if needed

### Rate Limiting

If experiencing 429 errors:
1. Review logs for `Retry-After` values
2. Consider reducing cron frequency
3. Check if multiple workers are running simultaneously

## Future Enhancements

- **Caching**: Cache ESPN responses for 1-5 minutes to reduce API calls
- **Differential updates**: Only update games that have changed status
- **Webhook support**: If ESPN adds webhook capabilities
- **Alternative sources**: Fallback to NFL.com or TheSportsDB if ESPN fails
- **Historical data**: Archive old ESPN responses for debugging
- **Performance metrics**: Track ESPN API response times and reliability

## Related Documentation

- [SCHEDULER.md](SCHEDULER.md) - Cron triggers for automated sync
- [DATA_SOURCES.md](DATA_SOURCES.md) - Original data source research
- [DATABASE.md](DATABASE.md) - Game and week table schemas
