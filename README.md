# NFL Loser Pick'em Bot

A workspace-scoped bot for running NFL "Loser Pick'em" leagues across Slack and Discord.

## Game Rules

- Each player picks one NFL team per week they believe will **lose**
- Picks lock at the scheduled kickoff time
- Players can change picks unlimited times before kickoff
- No team may be picked more than once per season by the same player
- Players cannot pick teams that don't play in a given week (bye weeks)
- If picked team loses → player wins that week
- If picked team wins or **ties** → player loses that week
- No pick made → bot assigns random team that **won** that week (not previously used) → loss
- Standings tracked as W–L record
- Players can join mid-season with no penalties (only count weeks after joining)

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Database**: PostgreSQL (with migration support)
- **Bot Platforms**: Slack & Discord (modular adapter pattern)
- **Deployment**: Serverless (AWS Lambda / Vercel / similar)
- **External Data**: ESPN API or TheSportsDB for game data

## Project Structure

```
src/
├── commands/         # Command handlers for /nfl actions
├── services/         # Business logic layer
├── models/           # Database models and types
├── adapters/         # Platform-specific integrations (Slack, Discord)
├── ingestion/        # External data source polling & normalization
├── scheduler/        # Cron jobs for reminders and finalization
├── render/           # Image and embed generation
└── utils/            # Helper functions

migrations/           # SQL migration files
tests/               # Unit and integration tests
config/              # Configuration files
docs/                # Additional documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Slack or Discord bot token

### Installation

```bash
npm install
```

### Database Setup

```bash
npm run migrate:up
```

### Configuration

Copy `.env.example` to `.env` and configure:

```
DATABASE_URL=postgresql://...
SLACK_BOT_TOKEN=xoxb-...
DISCORD_BOT_TOKEN=...
ESPN_API_KEY=...
TIMEZONE=America/New_York
```

### Development

```bash
npm run dev
```

### Testing

```bash
npm test
npm run test:integration
```

## Commands

### Player Commands
- `/nfl pick TEAM` - Make or change your weekly pick
- `/nfl my` - View your personal season summary
- `/nfl board [week]` - View standings (season or specific week)
- `/nfl help` - Display rules and usage

### Admin Commands
- `/nfl admin seed-season YEAR` - Load schedule for a season
- `/nfl admin open-week N` - Manually open a week
- `/nfl admin finalize-week N` - Force finalize a week
- `/nfl admin set-game GAMEID status=<...> score=<...>` - Override game data
- `/nfl admin reset-pick PLAYER WEEK` - Undo a player's pick
- `/nfl admin sync` - Refresh game data from external source
- `/nfl admin config` - Configure workspace settings

## Documentation

- [Technical Specification](./NFL%20Loser%20Pick%20'em%20Bot%20—%20Technical%20Speci.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [API Integration](./docs/DATA_SOURCES.md)
- [Finalized Decisions](./docs/DECISIONS_FINALIZED.md)

## Key Design Decisions

- **Slack First:** Slack integration prioritized over Discord
- **Workspace-Wide Reminders:** No per-player reminder preferences
- **Mid-Season Joins Allowed:** Players can join anytime with no penalties for missed weeks
- **Export & Archive:** Season data exported to JSON/CSV and purged after completion
- **Ties Count as Losses:** Consistent with "pick to lose" mechanic
- **Postponement Handling:** Picks automatically unlock if game kickoff time changes
- **Image Generation:** Server-side canvas library (lightweight, serverless-friendly)

See [DECISIONS_FINALIZED.md](./docs/DECISIONS_FINALIZED.md) for complete details.

## License

MIT
