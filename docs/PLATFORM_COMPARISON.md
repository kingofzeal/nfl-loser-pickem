# Platform Comparison: Discord vs Slack

Quick reference for choosing and deploying to Discord, Slack, or both.

## Quick Comparison

| Feature | Discord | Slack |
|---------|---------|-------|
| **Setup Complexity** | Medium - Slash commands, OAuth | Medium - Slash commands, OAuth |
| **Command Registration** | Automated via API | Manual via App Config |
| **Rich Formatting** | ✅ Embeds, buttons, colors | ⚠️ Basic blocks, limited colors |
| **User Experience** | Native slash commands | Native slash commands |
| **Workspace Model** | Auto-created per guild | Manual database entry |
| **Best For** | Gaming communities | Work teams, existing Slack users |

## Discord Setup Summary

### What You Need
- Discord Developer Account
- Bot Application
- 3 secrets: `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`

### Key Steps
1. Create bot at https://discord.com/developers/applications
2. Set secrets in Cloudflare
3. Deploy worker
4. Run `register-discord-commands.js` script
5. Set Interactions Endpoint URL
6. Invite bot to server
7. Commands appear automatically

### URLs
- **Developer Portal:** https://discord.com/developers/applications
- **Webhook Endpoint:** `https://YOUR-WORKER.workers.dev/discord/interactions`
- **Bot Invite:** `https://discord.com/api/oauth2/authorize?client_id=APP_ID&permissions=2147616832&scope=bot%20applications.commands`

### Workspace Creation
✅ **Automatic** - Created when first user runs a command

## Slack Setup Summary

### What You Need
- Slack Workspace
- Slack App
- 2 secrets: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

### Key Steps
1. Create app at https://api.slack.com/apps
2. Configure OAuth scopes: `commands`, `chat:write`, `users:read`, `team:read`
3. Install to workspace
4. Create `/nfl` slash command
5. Set secrets in Cloudflare
6. Deploy worker
7. **Run `setup-slack-workspace.js` script** (creates DB entry)
8. Update slash command Request URL
9. Test in channel

### URLs
- **App Portal:** https://api.slack.com/apps
- **Command Endpoint:** `https://YOUR-WORKER.workers.dev/slack/commands`

### Workspace Creation
⚠️ **Manual** - Must create database entry:
```bash
node scripts/setup-slack-workspace.js
# Or manually:
wrangler d1 execute nfl-loser-pickem-db --remote --command="INSERT INTO workspaces ..."
```

## Required Secrets

### Discord Only
```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_APPLICATION_ID
```

### Slack Only
```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
```

### Both Platforms
Run all 5 commands above. They coexist without conflict.

## Deployment Scripts

### Automated (Linux/Mac/WSL)
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
# Choose: 1) Discord, 2) Slack, or 3) Both
```

### Manual (Windows PowerShell)
Follow platform-specific sections in `DEPLOY_NOW.md`

## Testing Commands

Both platforms use identical command syntax:

```
/nfl help
/nfl pick ravens
/nfl my
/nfl board
/nfl admin sync 1
```

## Admin Setup

### Discord
```bash
# Auto-creates player on first command
wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM players"
wrangler d1 execute nfl-loser-pickem-db --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"
```

### Slack
```bash
# Same process
wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM players"
wrangler d1 execute nfl-loser-pickem-db --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"
```

## Troubleshooting

### Discord Issues

**"Invalid signature"**
- Check `DISCORD_PUBLIC_KEY` is correct (no spaces)
- Verify endpoint URL matches deployed worker

**"Commands not showing"**
- Wait up to 1 hour for global registration
- Use guild-specific: `node scripts/register-discord-commands.js --guild=YOUR_GUILD_ID`

### Slack Issues

**"verification_failed"**
- Check `SLACK_SIGNING_SECRET` is correct
- Verify Request URL in Slash Commands config

**"Workspace not registered"**
- Run `node scripts/setup-slack-workspace.js`
- Verify workspace exists: `wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM workspaces"`

**"/nfl command not found"**
- Verify slash command exists in app config
- Check Request URL points to correct worker

## Running Both Platforms

Yes, you can run both simultaneously! The bot will:
- Respond to Discord slash commands via interactions endpoint
- Respond to Slack slash commands via commands endpoint
- Maintain separate workspace/player records per platform
- Share the same database, game data, and season

### Setup for Both
1. Follow all Discord steps
2. Follow all Slack steps
3. Set all 5 secrets
4. Both platforms work independently

### Cost
Still **$0/month** on Cloudflare free tier for reasonable usage.

## Quick Start for Slack Users

If you're only deploying to Slack:

```powershell
# 1. Install & auth
npm install -g wrangler
wrangler login

# 2. Create & configure database
wrangler d1 create nfl-loser-pickem-db
# Update wrangler.toml with database_id
wrangler d1 migrations apply nfl-loser-pickem-db --remote
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-teams.sql
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-season-2025.sql

# 3. Set Slack secrets
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET

# 4. Deploy
npm run build
wrangler deploy

# 5. Configure Slack workspace
node scripts/setup-slack-workspace.js

# 6. Update Slack slash command URL
# Go to api.slack.com/apps → Your App → Slash Commands
# Set Request URL: https://YOUR-WORKER.workers.dev/slack/commands

# 7. Test
# In Slack: /nfl help
```

## Resources

- **Full Guide:** `DEPLOY_NOW.md`
- **Detailed Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
- **Discord Script:** `scripts/register-discord-commands.js`
- **Slack Script:** `scripts/setup-slack-workspace.js`
- **Automated Deploy:** `scripts/deploy.sh`
