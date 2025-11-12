# External Data Sources

## Overview

The bot requires NFL game schedules and live scores. Two primary options:

1. **ESPN API** (free, unofficial)
2. **TheSportsDB** (free tier available)
3. **NFL.com** (official, but complex)
4. **Static JSON** (manual updates)

## Recommended: ESPN API

### Schedule Endpoint
```
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
```

Query parameters:
- `dates=YYYYMMDD` - specific date
- `seasontype=2` - regular season (1=preseason, 3=playoffs)
- `week=1` - week number

### Response Structure
```json
{
  "week": {
    "number": 1
  },
  "events": [
    {
      "id": "401547417",
      "date": "2024-09-05T23:20Z",
      "name": "Kansas City Chiefs at Baltimore Ravens",
      "status": {
        "type": {
          "name": "STATUS_SCHEDULED | STATUS_IN_PROGRESS | STATUS_FINAL"
        }
      },
      "competitions": [
        {
          "competitors": [
            {
              "homeAway": "home",
              "team": {
                "id": "33",
                "abbreviation": "BAL",
                "displayName": "Baltimore Ravens"
              },
              "score": "20"
            },
            {
              "homeAway": "away",
              "team": {
                "id": "12",
                "abbreviation": "KC",
                "displayName": "Kansas City Chiefs"
              },
              "score": "27"
            }
          ]
        }
      ]
    }
  ]
}
```

### Mapping ESPN IDs to Internal Teams

Create a mapping table in `src/ingestion/team-mappings.ts`:

```typescript
export const ESPN_TEAM_MAP: Record<string, string> = {
  '1': 'falcons',      // Atlanta Falcons
  '2': 'bills',        // Buffalo Bills
  '3': 'bears',        // Chicago Bears
  // ... all 32 teams
  '33': 'ravens',      // Baltimore Ravens
};
```

---

## Alternative: TheSportsDB

### Schedule Endpoint
```
GET https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsseason.php?id=4391&s=2024
```

- `id=4391` is NFL league ID
- `s=2024` is the season year

### Live Scores
```
GET https://www.thesportsdb.com/api/v1/json/{API_KEY}/eventsday.php?d=YYYY-MM-DD&l=4391
```

### Response Structure
```json
{
  "events": [
    {
      "idEvent": "1234567",
      "strEvent": "Kansas City Chiefs vs Baltimore Ravens",
      "dateEvent": "2024-09-05",
      "strTime": "23:20:00",
      "strHomeTeam": "Baltimore Ravens",
      "strAwayTeam": "Kansas City Chiefs",
      "intHomeScore": "20",
      "intAwayScore": "27",
      "strStatus": "FT"
    }
  ]
}
```

---

## Ingestion Flow

### 1. Seed Season (One-time)
Admin runs `/nfl admin seed-season 2024`

**Process:**
1. Fetch full season schedule from ESPN
2. Create `season` record
3. Create 18 `week` records
4. Create ~272 `game` records with kickoff times
5. Log seed operation in audit_log

**Implementation:**
```typescript
async seedSeason(year: number): Promise<void> {
  const scheduleData = await espnClient.getSeasonSchedule(year);
  
  // Create season
  const season = await db.seasons.create({ year, weeks_count: 18 });
  
  // Group games by week
  for (let weekNum = 1; weekNum <= 18; weekNum++) {
    const week = await db.weeks.create({ season_id: season.id, week_number: weekNum });
    
    const weekGames = scheduleData.filter(g => g.week === weekNum);
    for (const game of weekGames) {
      await db.games.create({
        week_id: week.id,
        home_team_id: mapESPNTeam(game.homeTeamId),
        away_team_id: mapESPNTeam(game.awayTeamId),
        kickoff_time: game.date,
        status: 'scheduled',
        external_id: game.id
      });
    }
  }
}
```

---

### 2. Live Score Polling (Hourly)

**Scheduler Trigger:**
- Thursday: 6 PM – midnight
- Sunday: 10 AM – midnight
- Monday: 6 PM – midnight

**Process:**
1. Fetch current week's games from ESPN
2. For each game:
   - Update `status`, `home_score`, `away_score`
   - If final and scores differ, set `winner_team_id`
   - If tied, leave `winner_team_id` as NULL
3. If all games in week are final, trigger week finalization
4. Log sync in audit_log

**Implementation:**
```typescript
async syncGames(weekId: number): Promise<void> {
  const games = await db.games.findByWeek(weekId);
  const externalIds = games.map(g => g.external_id);
  
  const liveData = await espnClient.getLiveScores(externalIds);
  
  for (const game of games) {
    const liveGame = liveData.find(g => g.id === game.external_id);
    if (!liveGame) continue;
    
    const updates: Partial<Game> = {
      status: mapStatus(liveGame.status),
      home_score: liveGame.homeScore,
      away_score: liveGame.awayScore,
      updated_at: new Date()
    };
    
    if (liveGame.status === 'STATUS_FINAL') {
      if (liveGame.homeScore > liveGame.awayScore) {
        updates.winner_team_id = game.home_team_id;
      } else if (liveGame.awayScore > liveGame.homeScore) {
        updates.winner_team_id = game.away_team_id;
      }
      // Tie: winner_team_id remains NULL
    }
    
    await db.games.update(game.game_id, updates);
  }
  
  await auditService.log({
    action: 'games_synced',
    entity_type: 'week',
    entity_id: weekId,
    payload: { games_updated: games.length }
  });
  
  // Check if all games final
  const allFinal = await db.games.allFinalForWeek(weekId);
  if (allFinal) {
    await weekService.finalizeWeek(weekId);
  }
}
```

---

### 3. Admin Overrides

**Scenario:** Game postponed or incorrect data

Admin can manually set game status:
```
/nfl admin set-game 401547417 status=final score=27-20
```

**Implementation:**
```typescript
async overrideGame(
  gameId: number, 
  adminId: number,
  overrides: { status?: string; score?: string }
): Promise<void> {
  const updates: Partial<Game> = {};
  
  if (overrides.status) {
    updates.status = overrides.status;
  }
  
  if (overrides.score) {
    const [awayScore, homeScore] = overrides.score.split('-').map(Number);
    updates.away_score = awayScore;
    updates.home_score = homeScore;
    
    const game = await db.games.findById(gameId);
    if (homeScore > awayScore) {
      updates.winner_team_id = game.home_team_id;
    } else if (awayScore > homeScore) {
      updates.winner_team_id = game.away_team_id;
    }
  }
  
  await db.games.update(gameId, updates);
  
  await auditService.log({
    actor_type: 'admin',
    actor_id: adminId,
    action: 'game_override',
    entity_type: 'game',
    entity_id: gameId,
    payload: overrides
  });
}
```

---

## Error Handling

### API Failures
- **Retry**: 3 attempts with exponential backoff
- **Cache**: Use last known good data
- **Alert**: Log error, notify admin in announcement channel
- **Fallback**: Admin can manually trigger sync or set game data

### Data Inconsistencies
- If external ID not found, skip update
- If team mapping fails, log error and skip
- If scores invalid (negative, etc.), reject and log

### Rate Limiting
- ESPN: No official rate limit, but respect 1 req/sec
- TheSportsDB: Free tier = 2 req/sec
- Implement exponential backoff on 429 responses

---

## Configuration

### Environment Variables
```env
DATA_SOURCE=espn  # or thesportsdb
ESPN_API_BASE_URL=https://site.api.espn.com
THESPORTSDB_API_KEY=your_key_here
SYNC_INTERVAL_MINUTES=60
SYNC_ENABLED=true
```

### Runtime Config
```typescript
export const DATA_SOURCE_CONFIG = {
  provider: process.env.DATA_SOURCE || 'espn',
  syncInterval: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60'),
  retryAttempts: 3,
  retryDelayMs: 1000,
  timeout: 10000
};
```

---

## Testing

### Mock Data
Store sample ESPN responses in `tests/fixtures/espn-scoreboard.json`

### Integration Tests
```typescript
describe('GameService.syncGames', () => {
  it('should update game status from ESPN data', async () => {
    const mockResponse = loadFixture('espn-scoreboard.json');
    mockESPNClient.getLiveScores.mockResolvedValue(mockResponse);
    
    await gameService.syncGames(weekId);
    
    const game = await db.games.findById(gameId);
    expect(game.status).toBe('final');
    expect(game.home_score).toBe(20);
  });
});
```

---

## Future: Official NFL API

If/when official NFL API becomes available:
1. Create new adapter in `src/ingestion/adapters/nfl-official.ts`
2. Implement same interface as ESPN adapter
3. Switch via environment variable
4. No changes to services layer
