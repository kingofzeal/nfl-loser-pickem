# NFL Loser Pick'em Bot - Deployment Scripts

This directory contains scripts to help with deployment, database seeding, and maintenance.

## Deployment Scripts

### `register-discord-commands.js`
Registers Discord slash commands with the Discord API.

**Usage:**
```bash
# Using environment variables (recommended)
DISCORD_TOKEN=your_token APPLICATION_ID=your_app_id node scripts/register-discord-commands.js

# For guild-specific commands (instant updates)
DISCORD_TOKEN=your_token APPLICATION_ID=your_app_id node scripts/register-discord-commands.js --guild=YOUR_GUILD_ID
```

**When to run:**
- After creating your Discord application
- When adding new commands
- When modifying command options

### `deploy.sh`
Interactive deployment script that walks through the entire setup process.

**Usage:**
```bash
# Make executable (Linux/Mac)
chmod +x scripts/deploy.sh

# Run
./scripts/deploy.sh

# On Windows, use Git Bash or WSL
```

**What it does:**
1. Checks Cloudflare authentication
2. Creates D1 database
3. Runs migrations
4. Seeds data (teams and season)
5. Configures secrets
6. Builds the project
7. Deploys to Cloudflare Workers
8. Registers Discord commands

## Database Seeding Scripts

### seed-teams.sql

1. Create D1 database: `wrangler d1 create nfl-loser-pickem-db`
2. Update `database_id` in `wrangler.toml` with the created database ID
3. Run migrations: `npm run d1:migrate:local` (for local) or `npm run d1:migrate:remote` (for production)

## Seeding Commands

### Local Development (using `--local` flag)

```bash
# Seed all 32 NFL teams
npm run seed:teams

# Seed 2025 season with 18 weeks
npm run seed:season

# Or use wrangler directly:
wrangler d1 execute nfl-loser-pickem-db --local --file=./scripts/seed-teams.sql
wrangler d1 execute nfl-loser-pickem-db --local --file=./scripts/seed-season-2025.sql
```

### Production (using `--remote` flag)

```bash
# Seed teams to production
wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql

# Seed season to production
wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-season-2025.sql
```

## Available Scripts

### seed-teams.sql
Seeds all 32 NFL teams with:
- Team slug (e.g., 'chiefs', 'bills')
- Full name (e.g., 'Kansas City Chiefs')
- Conference (AFC/NFC)
- Division (North/South/East/West)

### seed-season-2025.sql
Seeds the 2025 NFL season with:
- Season record (year 2025, 18 weeks)
- 18 weeks with approximate dates
- All weeks in 'scheduled' state

**Note:** Week dates are approximate. Update them based on the actual NFL schedule.

## Custom Queries

You can also run custom SQL commands:

```bash
# Local
wrangler d1 execute nfl-loser-pickem-db --local --command="SELECT * FROM teams"

# Production
wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM teams"
```

## Troubleshooting

**Error: "database_id not found"**
- Make sure you've created the D1 database and added its ID to `wrangler.toml`

**Error: "no such table: teams"**
- Run migrations first: `npm run d1:migrate:local`

**Error: "UNIQUE constraint failed"**
- Data is already seeded. To re-seed, drop and recreate the database or delete existing rows first.
