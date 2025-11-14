# NFL Loser Pick'em Bot - Deployment Guide

> **Quick Start?** See [SLACK_QUICKSTART.md](./SLACK_QUICKSTART.md) or [DEPLOY_NOW.md](./DEPLOY_NOW.md) for fast deployment.

## Overview

This bot is **fully implemented** and ready for deployment to Cloudflare Workers. All core functionality is complete including:
- **Discord & Slack** command handling
- ESPN API integration for live scores
- Automated week management
- Pick validation and tracking
- Leaderboard generation
- Scheduled cron jobs

## Choose Your Platform

- 💬 **Slack Only:** See [SLACK_QUICKSTART.md](./SLACK_QUICKSTART.md) - 15 minutes
- 🎮 **Discord Only:** Follow this guide (Discord sections)
- 🎯 **Both Platforms:** Follow all sections below

## Prerequisites

- Node.js 22+ (for local development)
- Cloudflare account (free tier works)
- **Discord:** Bot Application OR **Slack:** App with OAuth token
- Wrangler CLI (`npm install -g wrangler`)

## Step 1: Cloudflare Setup

### 1.1 Login to Cloudflare

```bash
wrangler login
```

### 1.2 Create D1 Database

```bash
wrangler d1 create nfl-loser-pickem-db
```

Copy the `database_id` from the output and update it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nfl-loser-pickem-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 1.3 Create KV Namespace (Optional for caching)

```bash
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview
```

Update the IDs in `wrangler.toml`.

### 1.4 Create R2 Bucket (Optional for backups)

```bash
wrangler r2 bucket create nfl-loser-pickem-backups
```

## Step 2: Database Setup

### 2.1 Run Migrations

```bash
# Remote (production)
wrangler d1 migrations apply nfl-loser-pickem-db --remote

# Or local for testing
wrangler d1 migrations apply nfl-loser-pickem-db --local
```

### 2.2 Seed Teams

```bash
# Remote
wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql

# Or local
wrangler d1 execute nfl-loser-pickem-db --local --file=./scripts/seed-teams.sql
```

### 2.3 Seed Season (Optional)

```bash
# Create 2025 season with 18 weeks
wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-season-2025.sql
```

## Step 3: Discord Bot Setup

### 3.1 Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "NFL Loser Pick'em"
4. Go to "Bot" section, click "Add Bot"
5. Copy the **Bot Token**
6. Copy the **Public Key** from "General Information"
7. Copy the **Application ID**

### 3.2 Configure Bot Permissions

In the Discord Developer Portal:
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions:
   - Send Messages
   - Send Messages in Threads
   - Embed Links
   - Use Slash Commands
4. Copy the generated URL and use it to add the bot to your server

### 3.3 Register Slash Commands

Create a file `register-commands.js`:

```javascript
const DISCORD_TOKEN = 'YOUR_BOT_TOKEN';
const APPLICATION_ID = 'YOUR_APPLICATION_ID';

const commands = [
  {
    name: 'nfl',
    description: 'NFL Loser Pick\'em commands',
    options: [
      {
        name: 'pick',
        description: 'Make your pick for the week',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'team',
            description: 'Team slug (e.g., ravens, chiefs)',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'my',
        description: 'View your picks and record',
        type: 1,
      },
      {
        name: 'board',
        description: 'View the leaderboard',
        type: 1,
        options: [
          {
            name: 'week',
            description: 'Week number (optional)',
            type: 4, // INTEGER
            required: false,
          },
        ],
      },
      {
        name: 'help',
        description: 'Show help and rules',
        type: 1,
      },
      {
        name: 'admin',
        description: 'Admin commands',
        type: 1,
        options: [
          {
            name: 'action',
            description: 'Admin action to perform',
            type: 3,
            required: true,
            choices: [
              { name: 'Open Week', value: 'open-week' },
              { name: 'Finalize Week', value: 'finalize-week' },
              { name: 'Sync Games', value: 'sync' },
            ],
          },
          {
            name: 'week',
            description: 'Week number',
            type: 4,
            required: false,
          },
        ],
      },
    ],
  },
];

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  
  const result = await response.json();
  console.log('Commands registered:', result);
}

registerCommands();
```

Run it:
```bash
node register-commands.js
```

## Step 4: Configure Secrets

Store sensitive values as Cloudflare secrets:

```bash
wrangler secret put DISCORD_TOKEN
# Paste your Discord bot token

wrangler secret put DISCORD_PUBLIC_KEY
# Paste your Discord public key

wrangler secret put DISCORD_APPLICATION_ID
# Paste your Discord application ID
```

## Step 5: Deploy

### 5.1 Build the Project

```bash
npm install
npm run build
```

### 5.2 Deploy to Cloudflare

```bash
wrangler deploy
```

### 5.3 Note the Worker URL

The deployment will output a URL like:
```
https://nfl-loser-pickem.YOUR_SUBDOMAIN.workers.dev
```

### 5.4 Configure Discord Interaction Endpoint

1. Go back to Discord Developer Portal
2. Navigate to "General Information"
3. Set "Interactions Endpoint URL" to:
   ```
   https://nfl-loser-pickem.YOUR_SUBDOMAIN.workers.dev/discord/interactions
   ```
4. Save changes (Discord will send a test request to verify)

## Step 6: Initial Season Setup

Once deployed, use the admin commands to set up the season:

1. **Create Season** (if not already seeded):
   ```sql
   -- Run this via wrangler d1 execute
   INSERT INTO seasons (year, weeks_count, state) VALUES (2025, 18, 'active');
   ```

2. **Create Weeks** (if not already seeded):
   ```sql
   -- This should be in seed-season-2025.sql
   -- Creates 18 weeks for the season
   ```

3. **Sync Games**:
   Use Discord command: `/nfl admin sync 1` to sync Week 1 games from ESPN

4. **Open Week 1**:
   Use Discord command: `/nfl admin open-week 1`

## Step 7: Testing

### Test Commands

In your Discord server, try these commands:

1. `/nfl help` - Should show help message
2. `/nfl board` - Should show empty leaderboard (no players yet)
3. `/nfl pick ravens` - Should create a pick
4. `/nfl my` - Should show your pick
5. `/nfl admin sync 1` - Should sync games from ESPN

### Check Logs

Monitor logs in Cloudflare dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Go to "Logs" tab
4. View real-time logs

## Step 8: Cron Jobs

Verify cron triggers are configured in `wrangler.toml`:

```toml
[[triggers.crons]]
cron = "0 9 * * TUE"  # Week lock - Tuesday 9 AM UTC

[[triggers.crons]]
cron = "0 4 * * TUE"  # Standings update - Tuesday 4 AM UTC

# Add hourly sync:
[[triggers.crons]]
cron = "0 * * * *"    # Game sync - Every hour
```

Deploy again if you added the hourly cron:
```bash
wrangler deploy
```

## Troubleshooting

### Database Connection Issues

Check D1 binding:
```bash
wrangler d1 list
wrangler d1 info nfl-loser-pickem-db
```

### Discord Signature Verification Fails

- Ensure `DISCORD_PUBLIC_KEY` secret is correct
- Check the public key in Discord Developer Portal
- Verify no extra whitespace in the key

### Commands Not Showing

- Re-register commands with Discord API
- Wait 1 hour for global commands to propagate
- Or use guild-specific commands for instant updates

### Cron Jobs Not Running

- Check "Schedules" tab in Cloudflare dashboard
- Verify cron syntax in wrangler.toml
- Check logs during cron execution time

## Monitoring

### Health Check

```bash
curl https://nfl-loser-pickem.YOUR_SUBDOMAIN.workers.dev/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### View Audit Logs

Query the database:
```bash
wrangler d1 execute nfl-loser-pickem-db --remote \
  --command="SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10"
```

## Maintenance

### Weekly Tasks

1. Monitor game syncs (should be automatic)
2. Check week finalization (should be automatic)
3. Review audit logs for issues

### Seasonal Tasks

1. Create new season at year end
2. Archive previous season
3. Update team roster if needed

### Database Queries

```bash
# View all seasons
wrangler d1 execute nfl-loser-pickem-db --remote \
  --command="SELECT * FROM seasons"

# View all players
wrangler d1 execute nfl-loser-pickem-db --remote \
  --command="SELECT * FROM players"

# View leaderboard
wrangler d1 execute nfl-loser-pickem-db --remote \
  --command="SELECT p.display_name, s.wins, s.losses FROM standings s JOIN players p ON s.player_id = p.player_id ORDER BY s.wins DESC, s.losses ASC"
```

## Cost Estimate

With Cloudflare's free tier:
- **Workers**: 100,000 requests/day (free)
- **D1**: 5 GB storage (free), 5 million reads/day (free)
- **KV**: 100,000 reads/day (free)
- **R2**: 10 GB storage (free)

This bot should easily fit within free tier limits for a single league.

## Security Considerations

1. **Never commit secrets** - Use wrangler secrets
2. **Verify Discord signatures** - Already implemented
3. **Validate all user input** - Already implemented
4. **Rate limiting** - Consider adding if needed
5. **Admin-only commands** - Already implemented

## Support

For issues or questions:
1. Check Cloudflare Workers logs
2. Review audit_log table
3. Test commands locally with `wrangler dev --local`
4. Check Discord Developer Portal for webhook errors

## Local Development

```bash
# Start local dev server
wrangler dev --local

# Access at:
# http://localhost:8787/health
# http://localhost:8787/discord/interactions

# Test with curl:
curl http://localhost:8787/health
```

## Next Steps

Once deployed and tested:
1. Announce bot to your league
2. Have everyone make their first pick
3. Let the season begin!
4. Monitor first week closely
5. Adjust as needed

---

**Congratulations!** Your NFL Loser Pick'em Bot is now live! 🏈
