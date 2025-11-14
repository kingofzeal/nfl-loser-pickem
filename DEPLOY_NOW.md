# 🚀 Quick Deployment Guide

Get your NFL Loser Pick'em Bot running in production in ~30 minutes.

## Choose Your Platform

This bot supports **Discord**, **Slack**, or **both**. Pick your path:

- 🎮 **Discord** - Slash commands, rich embeds, easy setup
- 💬 **Slack** - Workspace integration, familiar interface
- 🎯 **Both** - Deploy once, use everywhere

## What You Need

- [ ] Cloudflare account (free tier works)
- [ ] **Discord:** Bot Application OR **Slack:** App/Bot Token
- [ ] 30 minutes of time
- [ ] Terminal/command line access

## Quick Start

### Option 1: Automated Script (Linux/Mac/WSL)

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Run deployment wizard
./scripts/deploy.sh
```

The script will guide you through each step interactively.

### Option 2: Manual Steps (Windows PowerShell/All Platforms)

#### 1. Install Wrangler CLI
```powershell
npm install -g wrangler
```

#### 2. Login to Cloudflare
```powershell
wrangler login
```

#### 3. Create Database
```powershell
wrangler d1 create nfl-loser-pickem-db
```

**Important:** Copy the `database_id` and paste it into `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "nfl-loser-pickem-db"
database_id = "PASTE_YOUR_ID_HERE"
```

Also uncomment and add your Cloudflare `account_id` to `wrangler.toml` (find it in your Cloudflare dashboard):
```toml
account_id = "your-account-id-here"
```

#### 4. Run Migrations
```powershell
wrangler d1 migrations apply nfl-loser-pickem-db --remote
```

#### 5. Seed Data
```powershell
# Seed all 32 NFL teams
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-teams.sql

# Seed 2025 season
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-season-2025.sql
```

#### 6A. Configure Discord Bot (Option 1)

<details>
<summary><b>Click to expand Discord setup instructions</b></summary>

1. Go to https://discord.com/developers/applications
2. Create new application: "NFL Loser Pick'em"
3. Go to **Bot** → Add Bot
4. Save these values:
   - Bot Token
   - Public Key (from General Information)
   - Application ID (from General Information)

**Set Cloudflare Secrets:**
```powershell
wrangler secret put DISCORD_TOKEN
# Paste your bot token

wrangler secret put DISCORD_PUBLIC_KEY
# Paste your public key

wrangler secret put DISCORD_APPLICATION_ID
# Paste your application ID
```

</details>

#### 6B. Configure Slack Bot (Option 2)

<details>
<summary><b>Click to expand Slack setup instructions</b></summary>

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: "NFL Loser Pick'em", choose workspace
4. Go to **OAuth & Permissions**:
   - Add Bot Token Scopes:
     - `commands` (for slash commands)
     - `chat:write` (send messages)
     - `users:read` (get user info)
   - Click **Install to Workspace**
   - Save the **Bot User OAuth Token** (starts with `xoxb-`)
5. Go to **Basic Information**:
   - Save the **Signing Secret**
6. Go to **Slash Commands** → **Create New Command**:
   - Command: `/nfl`
   - Request URL: `https://YOUR-WORKER.workers.dev/slack/commands` (add after deploy)
   - Short Description: "NFL Loser Pick'em commands"

**Set Cloudflare Secrets:**
```powershell
wrangler secret put SLACK_BOT_TOKEN
# Paste your Bot User OAuth Token (xoxb-...)

wrangler secret put SLACK_SIGNING_SECRET
# Paste your Signing Secret
```

</details>

#### 6C. Configure Both (Option 3)

Follow both 6A and 6B above. All secrets can coexist.

#### 7. Build and Deploy

```powershell
npm run build
wrangler deploy
```

**Save your Worker URL** from the output (e.g., `https://nfl-loser-pickem.YOUR-SUBDOMAIN.workers.dev`)

#### 8A. Complete Discord Setup (if using Discord)

<details>
<summary><b>Click to expand Discord completion steps</b></summary>

**Register Slash Commands:**
```powershell
$env:DISCORD_TOKEN="your_token_here"
$env:APPLICATION_ID="your_app_id_here"
node scripts/register-discord-commands.js
```

**Configure Webhook:**
1. Go to Discord Developer Portal → General Information
2. Set **Interactions Endpoint URL** to:
   ```
   https://nfl-loser-pickem.YOUR-SUBDOMAIN.workers.dev/discord/interactions
   ```
3. Click **Save** (Discord will verify your endpoint)

**Invite Bot to Server:**

Use this URL (replace `YOUR_APP_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2147616832&scope=bot%20applications.commands
```

</details>

#### 8B. Complete Slack Setup (if using Slack)

<details>
<summary><b>Click to expand Slack completion steps</b></summary>

**Update Request URL:**
1. Go to https://api.slack.com/apps → Your App
2. Go to **Slash Commands** → Edit `/nfl`
3. Update **Request URL** to:
   ```
   https://nfl-loser-pickem.YOUR-SUBDOMAIN.workers.dev/slack/commands
   ```
4. Click **Save**

**Create Workspace in Database:**
```powershell
wrangler d1 execute nfl-loser-pickem-db --remote --command="INSERT INTO workspaces (name, platform, platform_workspace_id) VALUES ('My League', 'slack', 'YOUR_SLACK_TEAM_ID')"
```

Find your Slack Team ID:
```powershell
# Visit: https://api.slack.com/methods/team.info/test
# Or check the Slack app settings → Basic Information → App ID
```

**Test the Bot:**
In any Slack channel: `/nfl help`

</details>

## First Time Setup

### Make Yourself Admin

1. Run any command (Discord: `/nfl help` or Slack: `/nfl help`)
2. Get your player ID:
   ```powershell
   wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM players"
   ```
3. Promote yourself:
   ```powershell
   wrangler d1 execute nfl-loser-pickem-db --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"
   ```

### Start the Season

1. **Sync Week 1 games:**
   ```
   /nfl admin sync 1
   ```

2. **Open Week 1:**
   ```
   /nfl admin open-week 1
   ```

3. **Make a test pick:**
   ```
   /nfl pick ravens
   ```

4. **View leaderboard:**
   ```
   /nfl board
   ```

## Verify Everything Works

- [ ] Health check: `curl https://YOUR-WORKER.workers.dev/health`
- [ ] Command works: `/nfl help`
- [ ] Can make pick: `/nfl pick chiefs`
- [ ] Board shows: `/nfl board`
- [ ] Admin sync: `/nfl admin sync 1`

## Next Steps

1. ✅ **Test thoroughly** - Make picks, change them, finalize weeks
2. 📢 **Invite players** - Share bot invite link with league
3. 📅 **Schedule opening** - Open Week 1 before first game
4. 🔍 **Monitor logs** - Check Cloudflare dashboard regularly
5. 📖 **Read full guide** - See `DEPLOYMENT_GUIDE.md` for details

## Troubleshooting

### General Issues

**"Database not found"**
- Check `database_id` in `wrangler.toml` matches created database

**"Worker errors"**
- Check logs: `wrangler tail`
- Verify all secrets are set: `wrangler secret list`

### Discord Issues

**"Invalid signature"**
- Verify `DISCORD_PUBLIC_KEY` secret is correct (no spaces)

**"Commands not showing"**
- Wait 1 hour for global commands to propagate
- Or use guild-specific registration (see `scripts/register-discord-commands.js --guild=YOUR_GUILD_ID`)

### Slack Issues

**"Slack signature verification failed"**
- Verify `SLACK_SIGNING_SECRET` is correct
- Check request URL in Slack app settings

**"/nfl command not found"**
- Verify slash command is created in Slack app
- Check Request URL points to your Worker: `https://YOUR-WORKER.workers.dev/slack/commands`

**"Workspace not registered"**
- Create workspace entry in database (see 8B above)
- Verify `platform_workspace_id` matches your Slack Team ID

## Support Resources

- **Detailed Guide:** `DEPLOYMENT_GUIDE.md`
- **Step-by-Step Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
- **Script Documentation:** `scripts/README.md`
- **Cloudflare Docs:** https://developers.cloudflare.com/workers/
- **Discord Docs:** https://discord.com/developers/docs/interactions/application-commands
- **Slack Docs:** https://api.slack.com/slash-commands

## Cost

**$0/month** on Cloudflare free tier for typical usage:
- 100,000 Worker requests/day (free)
- 5 million D1 reads/day (free)
- 5 GB D1 storage (free)

A single league will use <1% of these limits.

---

**Ready to deploy?** Run through the steps above, then see you on the field! 🏈
