# Deployment Checklist

Use this checklist to ensure a smooth deployment to Cloudflare Workers.

## Platform Selection

- [ ] Choose your platform(s):
  - [ ] **Discord** - Slash commands, rich embeds
  - [ ] **Slack** - Workspace integration
  - [ ] **Both** - Deploy to multiple platforms

## Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint clean (`npm run lint`)
- [ ] Documentation reviewed
- [ ] Environment secrets prepared

## Cloudflare Account Setup

- [ ] Cloudflare account created
- [ ] Account ID obtained (from dashboard)
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Authenticated with Cloudflare (`wrangler login`)

## Database Setup

### D1 Database Creation
- [ ] Run: `wrangler d1 create nfl-loser-pickem-db`
- [ ] Copy `database_id` from output
- [ ] Update `database_id` in `wrangler.toml`

### Run Migrations
- [ ] Run: `wrangler d1 migrations apply nfl-loser-pickem-db --remote`
- [ ] Verify migrations succeeded
- [ ] Check migration status: `wrangler d1 migrations list nfl-loser-pickem-db --remote`

### Seed Data
- [ ] Run: `wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql`
- [ ] Run: `wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-season-2025.sql`
- [ ] Verify teams seeded: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT COUNT(*) FROM teams"`
- [ ] Verify season created: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM seasons"`

## Platform Setup

Choose Discord, Slack, or both. Complete the relevant section(s) below.

<details>
<summary><b>🎮 Discord Bot Setup (Click to expand)</b></summary>

### Create Discord Application
- [ ] Go to https://discord.com/developers/applications
- [ ] Create new application: "NFL Loser Pick'em"
- [ ] Note **Application ID**
- [ ] Go to Bot section → Add Bot
- [ ] Note **Bot Token**
- [ ] Go to General Information → Note **Public Key**

### Bot Permissions
- [ ] Enable "Message Content Intent" (if reading messages)
- [ ] Enable "Server Members Intent" (for user info)
- [ ] Set OAuth2 scopes: `bot`, `applications.commands`
- [ ] Set bot permissions:
  - Send Messages
  - Send Messages in Threads
  - Embed Links
  - Attach Files (for image generation)
  - Use Slash Commands
  - Read Message History

### Invite Bot to Server
- [ ] Generate OAuth2 URL with correct scopes/permissions
- [ ] Invite bot to test server
- [ ] Verify bot appears in member list

### Register Discord Commands
- [ ] Run: `node scripts/register-discord-commands.js`
- [ ] Verify commands appear in Discord server (type `/nfl`)
- [ ] Test command autocomplete

### Set Discord Secrets
```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APPLICATION_ID
```
- [ ] `DISCORD_TOKEN` set
- [ ] `DISCORD_PUBLIC_KEY` set
- [ ] `DISCORD_APPLICATION_ID` set

</details>

<details>
<summary><b>💬 Slack App Setup (Click to expand)</b></summary>

### Create Slack App
- [ ] Go to https://api.slack.com/apps
- [ ] Click "Create New App" → "From scratch"
- [ ] Name: "NFL Loser Pick'em"
- [ ] Choose your workspace
- [ ] Note **App ID**

### Configure OAuth & Permissions
- [ ] Go to OAuth & Permissions
- [ ] Add Bot Token Scopes:
  - [ ] `commands`
  - [ ] `chat:write`
  - [ ] `chat:write.public`
  - [ ] `users:read`
  - [ ] `team:read`
- [ ] Click "Install to Workspace"
- [ ] Note **Bot User OAuth Token** (xoxb-...)

### Create Slash Command
- [ ] Go to Slash Commands → Create New Command
- [ ] Command: `/nfl`
- [ ] Request URL: `https://YOUR-WORKER.workers.dev/slack/commands` *(update after deploy)*
- [ ] Short Description: "NFL Loser Pick'em commands"
- [ ] Usage Hint: `pick [team] | my | board | help | admin [action]`
- [ ] Save

### Get Signing Secret
- [ ] Go to Basic Information
- [ ] Note **Signing Secret**

### Set Slack Secrets
```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
```
- [ ] `SLACK_BOT_TOKEN` set
- [ ] `SLACK_SIGNING_SECRET` set

</details>

## Configure Cloudflare Secrets (Additional)

### Optional Secrets
- [ ] `THESPORTSDB_API_KEY` (if using TheSportsDB instead of ESPN)

## Optional: KV Namespace (for caching)

- [ ] Run: `wrangler kv:namespace create CACHE`
- [ ] Run: `wrangler kv:namespace create CACHE --preview`
- [ ] Update `id` and `preview_id` in `wrangler.toml`

## Optional: R2 Bucket (for backups)

- [ ] Run: `wrangler r2 bucket create nfl-loser-pickem-backups`
- [ ] Verify bucket created: `wrangler r2 bucket list`

## Deploy Worker

- [ ] Update `account_id` in `wrangler.toml`
- [ ] Run: `npm run build`
- [ ] Run: `wrangler deploy`
- [ ] Note the deployed Worker URL
- [ ] Verify deployment: `curl https://YOUR-WORKER.workers.dev/health`

## Post-Deploy Platform Configuration

<details>
<summary><b>🎮 Complete Discord Setup (if using Discord)</b></summary>

### Configure Discord Webhook
- [ ] Go to Discord Developer Portal → General Information
- [ ] Set "Interactions Endpoint URL" to: `https://YOUR-WORKER.workers.dev/discord/interactions`
- [ ] Save and verify (Discord sends test ping)
- [ ] If verification fails, check `DISCORD_PUBLIC_KEY` secret

### Test Discord Commands
- [ ] Test: `/nfl help` - Should show help embed
- [ ] Test: `/nfl board` - Should show empty leaderboard
- [ ] Test: `/nfl pick ravens` - Should fail (no active week yet)

</details>

<details>
<summary><b>💬 Complete Slack Setup (if using Slack)</b></summary>

### Update Slash Command URL
- [ ] Go to https://api.slack.com/apps → Your App
- [ ] Go to Slash Commands → Edit `/nfl`
- [ ] Update Request URL to: `https://YOUR-WORKER.workers.dev/slack/commands`
- [ ] Save

### Create Workspace in Database
- [ ] Get your Slack Team ID (from app settings or API)
- [ ] Run: 
```bash
wrangler d1 execute nfl-loser-pickem-db --remote --command="INSERT INTO workspaces (workspace_name, platform, platform_workspace_id, webhook_url) VALUES ('My League', 'slack', 'YOUR_TEAM_ID', 'https://YOUR-WORKER.workers.dev/slack/commands')"
```
- [ ] Verify: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM workspaces"`

### Test Slack Commands
- [ ] In any channel, type: `/nfl help`
- [ ] Should receive help message
- [ ] Test: `/nfl board` - Should show empty leaderboard

</details>

## Initial Testing

### Health Check
- [ ] Test: `curl https://YOUR-WORKER.workers.dev/health`
- [ ] Should return: `{"status":"healthy","timestamp":"...","environment":"production"}`

### Database Verification
- [ ] Run: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM teams LIMIT 5"`
- [ ] Verify 32 teams exist
- [ ] Run: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM seasons"`
- [ ] Verify season created

### Platform Commands
- [ ] Test bot commands on your chosen platform (see platform-specific test sections above)

## Admin Setup

### Workspace Auto-Creation
The workspace will auto-create when first command is run:
- [ ] Run a command on your platform (Discord: `/nfl help` or Slack: `/nfl help`)
- [ ] Check: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM workspaces"`
- [ ] Verify workspace created
- [ ] **Note:** For Slack, you may need to manually create workspace (see Slack setup section above)

### Promote Admin
- [ ] Get player ID: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM players"`
- [ ] Update player: `wrangler d1 execute nfl-loser-pickem-db --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"`

### Sync Games
- [ ] Run: `/nfl admin sync 1` in Discord
- [ ] Verify games synced: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT COUNT(*) FROM games"`
- [ ] Should show ~14-16 games for week 1

### Open Week 1
- [ ] Run: `/nfl admin open-week 1` in Discord
- [ ] Verify week opened: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM weeks WHERE week_id = 1"`
- [ ] State should be `'open'`

## Production Validation

### Test Pick Flow
- [ ] Make a pick: `/nfl pick ravens`
- [ ] View pick: `/nfl my`
- [ ] Change pick: `/nfl pick chiefs`
- [ ] View updated pick: `/nfl my`
- [ ] View board: `/nfl board`

### Test Admin Flow
- [ ] Sync games: `/nfl admin sync 1`
- [ ] Check logs for successful sync
- [ ] Manually update a game to final (for testing):
  ```sql
  UPDATE games SET status = 'final', winner_team_id = home_team_id WHERE game_id = 1
  ```
- [ ] Finalize week: `/nfl admin finalize-week 1`
- [ ] Check standings updated

### Monitor Logs
- [ ] Open Cloudflare dashboard → Workers → Your Worker → Logs (Real-time)
- [ ] Run commands and watch logs
- [ ] Verify no errors

### Verify Cron Jobs
- [ ] Check: Cloudflare dashboard → Workers → Your Worker → Triggers → Cron Triggers
- [ ] Verify cron schedules are registered
- [ ] Wait for next scheduled run or trigger manually
- [ ] Check audit log for cron executions

## Post-Deployment

### Documentation
- [ ] Update README with production URL
- [ ] Document admin procedures
- [ ] Create player onboarding guide
- [ ] Document troubleshooting steps

### Monitoring Setup
- [ ] Set up Cloudflare email alerts for Worker errors
- [ ] Monitor D1 database size
- [ ] Set up audit log review schedule

### Backup Strategy
- [ ] Document season export process
- [ ] Schedule end-of-season archives
- [ ] Test restore procedure

### Communication
- [ ] Announce bot to league members
- [ ] Share command guide
- [ ] Set expectations for week schedule
- [ ] Provide support contact

## Week 1 Launch

- [ ] Verify all players have joined (run commands)
- [ ] Confirm all picks made before kickoff
- [ ] Monitor first game sync
- [ ] Watch first week finalization
- [ ] Review first standings update
- [ ] Collect feedback

## Rollback Plan (If Needed)

- [ ] Keep previous deployment available
- [ ] Document rollback command: `wrangler rollback`
- [ ] Have database backup procedure ready
- [ ] Communicate downtime to users

## Success Criteria

- [ ] All 32 teams seeded correctly
- [ ] Discord commands respond correctly
- [ ] Picks can be created and modified
- [ ] Games sync from ESPN successfully
- [ ] Week lifecycle works (open → in_progress → finalized)
- [ ] Standings calculate correctly
- [ ] Cron jobs execute on schedule
- [ ] Logs are clean (no critical errors)
- [ ] Response times < 1 second
- [ ] No data loss or corruption

---

## Quick Reference Commands

```bash
# Deploy
wrangler deploy

# View logs
wrangler tail

# Execute SQL
wrangler d1 execute nfl-loser-pickem-db --remote --command="YOUR_SQL_HERE"

# List secrets
wrangler secret list

# Rollback
wrangler rollback

# Local dev
wrangler dev --local
```

## Support Contacts

- Cloudflare Status: https://www.cloudflarestatus.com/
- Discord API Status: https://discordstatus.com/
- ESPN API Status: Check manually

---

**Note:** Check off each item as you complete it. Any issues? See DEPLOYMENT_GUIDE.md for detailed troubleshooting.
