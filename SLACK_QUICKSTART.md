# 💬 Slack Quick Start

**Deploy to Slack in 15 minutes** - Streamlined guide for Slack-only deployment.

## What You Need

- ✅ Cloudflare account (free)
- ✅ Slack workspace (admin access)
- ✅ 15 minutes

## Step-by-Step

### 1. Create Slack App (5 min)

1. **Go to:** https://api.slack.com/apps
2. **Click:** "Create New App" → "From scratch"
3. **Name:** "NFL Loser Pick'em"
4. **Choose** your workspace
5. **Go to:** OAuth & Permissions

**Add Bot Token Scopes:**
- `commands`
- `chat:write`
- `chat:write.public`
- `users:read`
- `team:read`

6. **Click:** "Install to Workspace"
7. **Copy:** Bot User OAuth Token (starts with `xoxb-...`)
8. **Go to:** Basic Information
9. **Copy:** Signing Secret

**Create Slash Command:**
- Go to: Slash Commands
- Click: Create New Command
- Command: `/nfl`
- Request URL: `https://TEMP.workers.dev` (update after deploy)
- Short Description: "NFL Loser Pick'em commands"
- Save

### 2. Setup Cloudflare (5 min)

```powershell
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Create database
wrangler d1 create nfl-loser-pickem-db
```

**Copy the `database_id` and update `wrangler.toml`:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "nfl-loser-pickem-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Paste here
```

Also uncomment and add your `account_id` at the top of `wrangler.toml`:
```toml
account_id = "your-account-id-here"  # ← Find in Cloudflare dashboard
```

**Run migrations:**
```powershell
wrangler d1 migrations apply nfl-loser-pickem-db --remote
```

**Seed data:**
```powershell
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-teams.sql
wrangler d1 execute nfl-loser-pickem-db --remote --file=.\scripts\seed-season-2025.sql
```

**Set secrets:**
```powershell
wrangler secret put SLACK_BOT_TOKEN
# Paste your Bot User OAuth Token

wrangler secret put SLACK_SIGNING_SECRET
# Paste your Signing Secret
```

### 3. Deploy (2 min)

```powershell
npm run build
wrangler deploy
```

**Copy your Worker URL** from the output!

### 4. Configure Slack (2 min)

**Update Slash Command:**
1. Go back to: https://api.slack.com/apps → Your App
2. Go to: Slash Commands → Edit `/nfl`
3. Update Request URL to: `https://YOUR-WORKER.workers.dev/slack/commands`
4. Save

**Create Workspace Entry:**
```powershell
node scripts/setup-slack-workspace.js
```

Follow the prompts to enter:
- Slack Team ID (from app settings)
- League name
- Worker URL

### 5. Test (1 min)

In any Slack channel:
```
/nfl help
```

You should see the help message! 🎉

### 6. Make Yourself Admin

```powershell
# Get your player ID
wrangler d1 execute nfl-loser-pickem-db --remote --command="SELECT * FROM players"

# Promote yourself (replace YOUR_ID)
wrangler d1 execute nfl-loser-pickem-db --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"
```

### 7. Sync Games

```
/nfl admin sync 1
/nfl admin open-week 1
```

## All Done! 🏈

Now you can:
- Make picks: `/nfl pick ravens`
- View standings: `/nfl board`
- Check your picks: `/nfl my`

## Common Issues

**"Workspace not registered"**
- Run: `node scripts/setup-slack-workspace.js`
- Or manually create workspace in database

**"Signature verification failed"**
- Check `SLACK_SIGNING_SECRET` is correct
- No extra spaces when pasting

**"Command not found"**
- Verify slash command exists in Slack app
- Check Request URL is correct
- Wait 1-2 minutes after saving changes

## Next Steps

1. ✅ Invite your league members
2. ✅ Test making picks
3. ✅ Sync games weekly: `/nfl admin sync WEEK`
4. ✅ Open weeks before games start: `/nfl admin open-week WEEK`

## Full Documentation

- **Complete Guide:** `DEPLOY_NOW.md`
- **Platform Comparison:** `docs/PLATFORM_COMPARISON.md`
- **Detailed Checklist:** `docs/DEPLOYMENT_CHECKLIST.md`

## Cost

**$0/month** for typical usage on Cloudflare's free tier:
- 100,000 requests/day
- 5M database reads/day
- 5GB storage

A 10-person league will use ~0.1% of these limits.

---

**Questions?** Check `docs/PLATFORM_COMPARISON.md` for troubleshooting and advanced configuration.
