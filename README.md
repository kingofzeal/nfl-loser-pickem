# NFL Loser Pick'em Bot

A serverless bot for running NFL "Loser Pick'em" leagues on **Discord** and **Slack**.

> 🎮 **Discord** - Rich embeds, slash commands, gaming communities  
> 💬 **Slack** - Workspace integration, slash commands, work teams  
> 🎯 **Both** - Deploy once, use everywhere

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

- **Runtime**: Cloudflare Workers (Edge compute)
- **Language**: TypeScript 5.6
- **Database**: Cloudflare D1 (SQLite at edge)
- **Bot Platforms**: Discord & Slack (modular adapter pattern)
- **Deployment**: Cloudflare Workers (serverless, $0 for typical usage)
- **External Data**: ESPN API or TheSportsDB for game data
- **Scheduling**: Cloudflare Cron Triggers

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

## Quick Start

### 30-Minute Deployment

Get running in production fast:

```powershell
# Windows PowerShell - See DEPLOY_NOW.md for full guide
npm install -g wrangler
wrangler login
wrangler d1 create nfl-loser-pickem-db
# Update wrangler.toml with database_id
wrangler d1 migrations apply nfl-loser-pickem-db --remote
npm run build
wrangler deploy
```

**Choose your platform:**
- 🎮 **Discord:** See `DEPLOY_NOW.md` → Section 6A
- 💬 **Slack:** See `DEPLOY_NOW.md` → Section 6B
- 🎯 **Both:** Follow both sections

### Prerequisites

- Cloudflare account (free tier works)
- **Discord:** Bot application from https://discord.com/developers/applications
- **Slack:** App from https://api.slack.com/apps
- Node.js 22+ for local development (optional)

### Local Development

```bash
npm install
npm run build
npm test
wrangler dev  # Test locally
```

### Configuration

Secrets managed via Wrangler CLI:

**Discord:**
```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APPLICATION_ID
```

**Slack:**
```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
```

See `wrangler.toml` for all configuration options.

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

- **[🚀 Quick Deployment Guide](./DEPLOY_NOW.md)** - Get running in 30 minutes
- **[📋 Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md)** - Step-by-step verification
- **[🎯 Platform Comparison](./docs/PLATFORM_COMPARISON.md)** - Discord vs Slack guide
- [Detailed Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Technical Specification](./NFL%20Loser%20Pick%20'em%20Bot%20—%20Technical%20Speci.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [API Integration](./docs/DATA_SOURCES.md)
- [Project Roadmap](./docs/ROADMAP.md)

## Deployment Resources

- **Scripts:**
  - `scripts/register-discord-commands.js` - Register Discord slash commands
  - `scripts/setup-slack-workspace.js` - Configure Slack workspace
  - `scripts/deploy.sh` - Automated deployment (Linux/Mac)
- **Database:**
  - `scripts/seed-teams.sql` - Load all 32 NFL teams
  - `scripts/seed-season-2025.sql` - Pre-populate 2025 season structure

## Key Features

- **Multi-Platform:** Discord and Slack support with shared database
- **Workspace-Wide Reminders:** No per-player reminder preferences
- **Mid-Season Joins Allowed:** Players can join anytime with no penalties for missed weeks
- **Export & Archive:** Season data exported to JSON/CSV and purged after completion
- **Ties Count as Losses:** Consistent with "pick to lose" mechanic
- **Postponement Handling:** Picks automatically unlock if game kickoff time changes
- **Image Generation:** Server-side canvas library (lightweight, serverless-friendly)

See [DECISIONS_FINALIZED.md](./docs/DECISIONS_FINALIZED.md) for complete details.

## License

MIT
