# Wrangler Configuration Setup

## Why is `wrangler.toml` gitignored?

The `wrangler.toml` file contains **account-specific resource IDs** that are unique to your Cloudflare deployment:

- `account_id` - Your Cloudflare account ID (not secret, but unique to you)
- `database_id` - Your D1 database ID (created when you run `wrangler d1 create`)
- KV namespace IDs (if you use caching)
- R2 bucket names (if you use backups)

These values are **not secrets** (they're visible in the Cloudflare dashboard and Worker logs), but they're **specific to your deployment** and shouldn't be committed to version control.

## What IS secret?

Actual secrets are managed separately via `wrangler secret put` and stored encrypted in Cloudflare:

- `SLACK_BOT_TOKEN` - Your Slack bot OAuth token
- `SLACK_SIGNING_SECRET` - Your Slack signing secret
- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_PUBLIC_KEY` - Your Discord app public key

## Setup Process

### 1. Create your local configuration

```powershell
# Copy the template to create your wrangler.toml
cp wrangler.template.toml wrangler.toml
```

### 2. Create resources and update IDs

```powershell
# Create D1 database
wrangler d1 create nfl-loser-pickem-db

# Copy the database_id from output
# Paste it into wrangler.toml under [[d1_databases]]
```

### 3. (Optional) Add account_id

The `account_id` is **optional** - wrangler will use your default account if not specified. Only add it if you have multiple Cloudflare accounts and need to specify which one to use.

Find your account ID at: https://dash.cloudflare.com/ (in the URL after you log in)

### 4. Deploy

```powershell
wrangler deploy
```

## Template vs. Your Config

| File | Purpose | In Git? |
|------|---------|---------|
| `wrangler.template.toml` | Template for new deployments | ✅ Yes |
| `wrangler.toml` | Your actual config with real IDs | ❌ No (gitignored) |

## Multiple Environments

You can have separate configurations for dev/staging/production:

```toml
# Production (default)
[[d1_databases]]
binding = "DB"
database_id = "prod-database-id"

# Development
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_id = "dev-database-id"
```

Deploy to specific environment:
```powershell
wrangler deploy --env dev
```

## Troubleshooting

### "Error: No wrangler.toml found"

Copy the template:
```powershell
cp wrangler.template.toml wrangler.toml
```

### "Error: D1 database not found"

Make sure you:
1. Created the database: `wrangler d1 create nfl-loser-pickem-db`
2. Copied the `database_id` into your `wrangler.toml`
3. The `database_id` matches exactly (no extra spaces/quotes)

### "Error: Unauthorized"

Make sure you're logged in:
```powershell
wrangler login
```

## Security Best Practices

✅ **DO:**
- Keep `wrangler.toml` in `.gitignore`
- Use `wrangler secret put` for actual secrets
- Share `wrangler.template.toml` in the repo
- Document setup steps in deployment guides

❌ **DON'T:**
- Commit `wrangler.toml` with your IDs
- Put tokens/secrets in `wrangler.toml` (use `wrangler secret put`)
- Share your `wrangler.toml` publicly
- Hard-code secrets in source code

## More Information

- [Wrangler Configuration Docs](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Managing Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [D1 Setup Guide](https://developers.cloudflare.com/d1/get-started/)
