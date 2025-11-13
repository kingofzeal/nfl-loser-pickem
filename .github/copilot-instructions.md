# NFL Loser Pick'em Bot - Copilot Instructions

This is a **TypeScript-based bot for Discord and Slack** for managing NFL "Loser Pick'em" leagues, deployed on **Cloudflare Workers** with **D1 (SQLite)** database. Players pick one team each week to lose, and can't pick the same team twice per season. The bot uses an **adapter pattern** to support both platforms with a shared business logic layer.

## Core Technologies

- **Runtime**: Cloudflare Workers (serverless, not Node.js)
- **Language**: TypeScript 5.6+ with strict type checking
- **Database**: Cloudflare D1 (SQLite-based, serverless SQL database)
- **Storage**: Cloudflare KV (key-value) and R2 (object storage)
- **Platforms**: Discord (Interactions API) and Slack (Bolt framework)
- **Architecture**: Adapter pattern for platform-agnostic business logic
- **Testing**: Jest with better-sqlite3 for local D1 testing

## Important: This is NOT a Node.js project

⚠️ **Critical**: This project runs on Cloudflare Workers, which uses V8 isolates, NOT Node.js. Do not:
- Use Node.js-specific APIs (`fs`, `path`, `process`, etc.)
- Use `require()` - use ES modules only
- Install Node.js-only packages
- Use `node-cron` or other Node.js schedulers (use Cloudflare Cron Triggers)

## Database: D1 (SQLite) - Single Implementation

This project uses **Cloudflare D1** exclusively. There is NO PostgreSQL code or hybrid approach.

### D1 Key Differences from PostgreSQL
- Syntax: `AUTOINCREMENT` not `SERIAL`, `TEXT` not `VARCHAR`, `INTEGER(0/1)` not `BOOLEAN`
- Placeholders: Use `?` not `$1, $2, $3`
- Timestamps: `datetime('now')` not `NOW()`
- JSON: Store as `TEXT`, parse manually (no `JSONB`)
- **No Triggers**: All validation logic is in the application layer (especially `PickService`)

### Database Operations
```typescript
// D1 query pattern
const result = await db.prepare('SELECT * FROM teams WHERE id = ?')
  .bind(teamId)
  .first(); // or .all() for multiple rows

// Insert/Update/Delete
await db.prepare('INSERT INTO picks (player_id, week_id, team_id) VALUES (?, ?, ?)')
  .bind(playerId, weekId, teamId)
  .run();
```

### Validation Logic (Previously in Database Triggers)
These checks MUST be implemented in `PickService`:
1. **No repeat teams**: Player cannot pick the same team twice in a season
2. **Team plays in week**: Selected team must have a game scheduled that week
3. **Manual timestamps**: Set `updated_at = datetime('now')` in UPDATE queries

## Development Workflow

### Build and Test
```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint
```

### Local Development with Wrangler
```bash
# Start local dev server (uses --local flag for D1/KV/R2)
npm run dev

# Run migrations locally
npm run d1:migrate:local

# Seed database locally
npm run seed:teams
npm run seed:season

# Execute custom D1 queries
wrangler d1 execute nfl-loser-pickem-db --local --command="SELECT * FROM teams"
```

### Deployment
```bash
# Deploy to Cloudflare
npm run deploy

# Run migrations on production
npm run d1:migrate:remote

# Seed production database
wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql
```

## Code Standards

### TypeScript Guidelines
1. **Strict typing**: No `any` types - use proper interfaces from `src/types/index.ts`
2. **Interface segregation**: Services use interfaces (`IPickService`, `IGameService`, etc.)
3. **Dependency injection**: Services receive dependencies in constructor
4. **Error handling**: Use try-catch with descriptive error messages
5. **Async/await**: All database operations are async

### File Organization
- `src/commands/`: Discord command handlers (one per command)
- `src/services/`: Business logic with interfaces in `services/interfaces/`
- `src/database/`: D1 connection and database operations
- `src/utils/`: Helper functions, logger, team mappings
- `src/types/`: Shared TypeScript interfaces and types
- `migrations/`: D1 SQL migration files (SQLite syntax)
- `scripts/`: Seeding scripts (SQL files for wrangler CLI)
- `tests/`: Jest tests with `integration/` and `unit/` subdirectories

### Testing Requirements
1. **Use better-sqlite3** for local D1 testing (mimics D1 API)
2. **Integration tests**: Test database operations end-to-end
3. **Unit tests**: Test service logic with mocked dependencies
4. **Mock D1Database**: Create mock objects that match Cloudflare's D1 interface
5. **Test fixtures**: Use `tests/fixtures/` for sample data (e.g., ESPN responses)

### Platform Integration
- **Discord**: Ed25519 signature verification, webhook-based interactions (no gateway)
- **Slack**: Bolt framework with socket mode or webhook events
- **Adapter Pattern**: Platform-specific adapters translate to common command interface
- **Shared Logic**: All business logic in services, not in platform adapters
- **Response Formatting**: Adapters handle platform-specific message formatting (embeds, blocks, etc.)

## Repository Structure

- `src/index.ts`: Cloudflare Workers entry point (`fetch()` and `scheduled()` handlers)
- `src/database/connection.ts`: D1 connection adapter
- `src/database/Database.ts`: All database CRUD operations
- `src/commands/*CommandHandler.ts`: Discord command implementations
- `src/services/`: Business logic layer (not yet implemented)
- `wrangler.toml`: Cloudflare configuration (D1, KV, R2 bindings)
- `migrations/`: D1 migrations (run with `wrangler d1 migrations apply`)
- `docs/`: Comprehensive project documentation

## Key Guidelines

1. **Follow existing patterns**: Look at command handlers and database operations for examples
2. **Use interfaces**: All services should implement their corresponding interface
3. **Platform agnostic**: Business logic in services, platform-specific code in adapters
4. **Check documentation**: Extensive docs in `docs/` directory (especially `ARCHITECTURE.md`, `DATABASE.md`, `CLOUDFLARE_COMPATIBILITY.md`)
5. **SQLite syntax**: Remember D1 is SQLite, not PostgreSQL
6. **No Node.js APIs**: Cloudflare Workers has limited Node.js compatibility
7. **Write tests**: Add unit tests for services, integration tests for database operations
8. **Update timestamps manually**: No database triggers - handle in application code

## Current Project Status

### Completed
- ✅ Core infrastructure (types, utils, config)
- ✅ Database layer (D1 implementation only)
- ✅ Command handlers (skeleton implementations)
- ✅ Migrations (5 files, SQLite syntax)
- ✅ Test infrastructure (Jest + better-sqlite3)
- ✅ Seeding scripts (SQL files for teams and 2025 season)

### In Progress / Next Steps
- 🚧 Service layer implementation (Phase 3)
  - PickService (with trigger validation logic)
  - WeekService
  - GameService (ESPN API integration)
  - StandingsService
  - AuditService
  - RenderService

### Not Started
- ⏳ Slack adapter implementation (Bolt framework)
- ⏳ Discord adapter implementation (webhook interactions)
- ⏳ ESPN API integration for live game scores
- ⏳ Scheduled jobs for score updates
- ⏳ Advanced leaderboard rendering
- ⏳ Bot registration and deployment for both platforms

## Common Pitfalls to Avoid

1. **Don't use PostgreSQL syntax**: This is D1 (SQLite), not PostgreSQL
2. **Don't use Node.js APIs**: Cloudflare Workers is not Node.js
3. **Don't forget validation**: Trigger logic must be in `PickService`
4. **Don't use `SERIAL`**: Use `INTEGER PRIMARY KEY AUTOINCREMENT`
5. **Don't use `NOW()`**: Use `datetime('now')`
6. **Don't use `BOOLEAN`**: Use `INTEGER` with 0/1 values
7. **Don't forget to bind parameters**: Always use `.bind()` with parameterized queries
8. **Don't use TypeScript seeding scripts**: Use SQL files with wrangler CLI

## Deployment Checklist

Before deploying to Cloudflare:
1. Create D1 database: `wrangler d1 create nfl-loser-pickem-db`
2. Update `database_id` in `wrangler.toml`
3. Run migrations: `npm run d1:migrate:remote`
4. Seed data: Use wrangler with `--remote` flag
5. Set secrets: `wrangler secret put DISCORD_PUBLIC_KEY`, `wrangler secret put SLACK_BOT_TOKEN`, etc.
6. Deploy: `npm run deploy`
7. Register commands with Discord bot application ID and/or Slack app manifest

## Documentation

Comprehensive documentation is available in the `docs/` directory:
- `ARCHITECTURE.md`: System design and component overview
- `DATABASE.md`: Database schema and relationships
- `CLOUDFLARE_COMPATIBILITY.md`: D1 migration details and differences
- `DEPLOYMENT.md`: Deployment steps and configuration
- `QUICK_REFERENCE.md`: Common commands and operations
