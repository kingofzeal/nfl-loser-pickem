# Architecture Overview

## High-Level Design

The NFL Loser Pick'em Bot follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│          Platform Adapters (Slack/Discord)          │
│              (Message formatting, auth)              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Command Router & Handlers               │
│          (Parse commands, validate, route)           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                 Services Layer                       │
│  PickService | WeekService | StandingsService |      │
│  GameService | AuditService | RenderService          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│            Database Layer (PostgreSQL)               │
│   Teams | Seasons | Weeks | Games | Players |       │
│   Picks | Standings | Workspaces | AuditLog         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              External Services                       │
│   ESPN API / TheSportsDB (game data ingestion)      │
└─────────────────────────────────────────────────────┘
```

## Core Components

### 1. Platform Adapters
- Abstract platform-specific implementations (Slack, Discord)
- Handle authentication, message formatting, and webhooks
- Convert platform events to normalized internal format
- Send responses (ephemeral, public, DMs)

### 2. Command Router
- Parse `/nfl` commands and subcommands
- Validate permissions (player vs admin)
- Route to appropriate handler
- Handle error responses

### 3. Services Layer

#### PickService
- **validatePick**: Check team availability, week open, not locked
- **createPick**: Store pick, check for duplicates
- **changePick**: Update existing pick if not locked
- **lockPick**: Mark pick locked at kickoff time
- **assignRandomTeam**: Auto-assign on missing pick

#### WeekService
- **openWeek**: Set week state to open, post announcement
- **closeGames**: Lock individual games at kickoff
- **finalizeWeek**: When all games final, trigger outcome calculation
- **getWeekStatus**: Current state of week

#### StandingsService
- **calculateOutcomes**: Process week results, determine winners
- **updateStandings**: Increment W/L records
- **getLeaderboard**: Sorted standings for display
- **getPlayerRecord**: Individual season summary

#### GameService
- **syncGames**: Fetch from external API, normalize, upsert
- **updateGameStatus**: Mark in-progress, final, etc.
- **setWinner**: Record winning team
- **triggerRecalculation**: When game status changes after finalization

#### AuditService
- **logAction**: Record player/admin/system actions
- **getAuditTrail**: Retrieve history for debugging

#### RenderService
- **generatePickConfirmation**: Ephemeral embed/block
- **generateMySummary**: Personal season view
- **generateBoard**: Standings table
- **generateWeeklyImage**: Public summary image with grid

### 4. Ingestion Module
- Poll ESPN/TheSportsDB API hourly during game windows
- Normalize external IDs to internal team references
- Upsert game records with status, scores, kickoff times
- Trigger pick locking and outcome recalculation

### 5. Scheduler
- **Tuesday AM**: Auto-open next week, post announcement
- **Friday/Sunday**: Send reminders (workspace timezone, player overrides)
- **During games**: Poll scores, update status
- **After games**: Finalize week when all games complete

### 6. Database Layer
- PostgreSQL with strict workspace isolation
- Migrations managed with migration tool
- Constraints enforce:
  - One pick per player per week
  - No repeat teams per player per season
  - Foreign key integrity

## Data Flow

### Making a Pick
1. User types `/nfl pick RAVENS` in Slack/Discord
2. Adapter normalizes to internal command format
3. Router validates user, workspace, parses team name
4. PickService checks:
   - Week is open
   - Team not used by player this season
   - Game not kicked off
5. Pick stored in database
6. RenderService generates confirmation
7. Adapter sends ephemeral response

### Week Finalization
1. Scheduler detects all games in week marked "final"
2. WeekService triggers finalization
3. StandingsService:
   - Loops through all picks for the week
   - Checks if picked team lost
   - Updates player W/L record
4. RenderService generates weekly summary image
5. Adapter posts public message in announcement channel
6. AuditService logs finalization event

### Game Data Sync
1. Scheduler triggers hourly during game windows
2. GameService fetches from ESPN API
3. Normalize: map external team IDs to internal team_id
4. Upsert into Games table (update scores, status, winner)
5. If status changed to "final", check if week can finalize
6. If game reached kickoff time, trigger pick locking

## Design Principles

### Workspace Isolation
- Every player, pick, and standing scoped to workspace
- Admins only affect their workspace
- Global data (teams, schedules) shared, outcomes isolated

### Privacy
- All picks ephemeral until week completion
- Only final results posted publicly
- Player can view own history anytime

### Reliability
- Kickoff-based locking (not dependent on live feed)
- Admin overrides for edge cases
- Audit trail for all state changes
- Retry logic for external API failures

### Scalability
- Serverless-friendly (stateless handlers)
- Database connection pooling
- Rate limiting on external APIs
- Image generation can be offloaded to queue

## Security Considerations

- Bot tokens stored as environment secrets
- Admin commands require role verification
- SQL injection prevention (parameterized queries)
- Rate limiting on user commands
- Workspace isolation enforced at database level

## Deployment Model

### Option 1: AWS Lambda + RDS
- Lambda functions for command handlers
- EventBridge for scheduler
- RDS PostgreSQL for database
- S3 for generated images

### Option 2: Vercel + Neon
- Vercel serverless functions
- Vercel Cron for scheduler
- Neon PostgreSQL (serverless)
- Vercel Blob for images

### Option 3: Traditional VPS
- Node.js process
- node-cron for scheduling
- PostgreSQL instance
- Local file storage or CDN

## Future Enhancements

- [ ] Multi-league support per workspace
- [ ] Custom scoring rules
- [ ] Playoff brackets
- [ ] Historical season archives
- [ ] Player statistics and analytics
- [ ] Integration with NFL.com for official data
- [ ] Mobile app notifications
