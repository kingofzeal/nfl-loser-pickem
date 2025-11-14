#!/bin/bash

# NFL Loser Pick'em Bot - Quick Deployment Script
# This script automates the initial deployment to Cloudflare Workers

set -e  # Exit on error

echo "🏈 NFL Loser Pick'em Bot - Deployment Script"
echo "=============================================="
echo ""
echo "Choose your platform:"
echo "  1) Discord"
echo "  2) Slack"
echo "  3) Both Discord and Slack"
echo ""
read -p "Enter your choice (1-3): " PLATFORM_CHOICE
echo ""

case $PLATFORM_CHOICE in
    1)
        PLATFORM="discord"
        echo "📱 Deploying for Discord"
        ;;
    2)
        PLATFORM="slack"
        echo "💬 Deploying for Slack"
        ;;
    3)
        PLATFORM="both"
        echo "🎯 Deploying for both Discord and Slack"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: Wrangler CLI is not installed${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Cloudflare${NC}"
    echo "Running: wrangler login"
    wrangler login
fi

echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Step 1: Create D1 Database
echo "📦 Step 1: Setting up D1 Database"
echo "----------------------------------"
read -p "Create new D1 database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating database..."
    wrangler d1 create nfl-loser-pickem-db
    echo ""
    echo -e "${YELLOW}⚠️  Copy the database_id from above and update wrangler.toml${NC}"
    echo ""
    read -p "Press enter once you've updated wrangler.toml..."
fi

# Step 2: Run Migrations
echo ""
echo "🔄 Step 2: Running Database Migrations"
echo "--------------------------------------"
read -p "Run migrations to remote database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running migrations..."
    wrangler d1 migrations apply nfl-loser-pickem-db --remote
    echo -e "${GREEN}✓ Migrations applied${NC}"
fi

# Step 3: Seed Data
echo ""
echo "🌱 Step 3: Seeding Database"
echo "---------------------------"
read -p "Seed teams data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Seeding teams..."
    wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-teams.sql
    echo -e "${GREEN}✓ Teams seeded${NC}"
fi

read -p "Seed 2025 season? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Seeding season..."
    wrangler d1 execute nfl-loser-pickem-db --remote --file=./scripts/seed-season-2025.sql
    echo -e "${GREEN}✓ Season seeded${NC}"
fi

# Step 4: Configure Secrets
echo ""
echo "🔐 Step 4: Configuring Secrets"
echo "------------------------------"

if [[ "$PLATFORM" == "discord" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "📱 Discord Secrets"
    echo "You'll need these values from Discord Developer Portal:"
    echo "1. Bot Token"
    echo "2. Public Key"
    echo "3. Application ID"
    echo ""
    read -p "Configure Discord secrets now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Setting DISCORD_TOKEN..."
        wrangler secret put DISCORD_TOKEN
        
        echo "Setting DISCORD_PUBLIC_KEY..."
        wrangler secret put DISCORD_PUBLIC_KEY
        
        echo "Setting DISCORD_APPLICATION_ID..."
        wrangler secret put DISCORD_APPLICATION_ID
        
        echo -e "${GREEN}✓ Discord secrets configured${NC}"
    fi
fi

if [[ "$PLATFORM" == "slack" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "💬 Slack Secrets"
    echo "You'll need these values from Slack API portal:"
    echo "1. Bot User OAuth Token (xoxb-...)"
    echo "2. Signing Secret"
    echo ""
    read -p "Configure Slack secrets now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Setting SLACK_BOT_TOKEN..."
        wrangler secret put SLACK_BOT_TOKEN
        
        echo "Setting SLACK_SIGNING_SECRET..."
        wrangler secret put SLACK_SIGNING_SECRET
        
        echo -e "${GREEN}✓ Slack secrets configured${NC}"
    fi
fi

# Step 5: Build
echo ""
echo "🔨 Step 5: Building Project"
echo "---------------------------"
echo "Running: npm run build"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Step 6: Deploy
echo ""
echo "🚀 Step 6: Deploying to Cloudflare Workers"
echo "-------------------------------------------"
read -p "Deploy now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying..."
    wrangler deploy
    echo -e "${GREEN}✓ Deployed successfully${NC}"
    echo ""
    echo "Your worker is now live!"
    echo ""
fi

# Step 7: Platform-specific setup
echo ""
echo "🎮 Step 7: Platform-specific Setup"
echo "-----------------------------------"

if [[ "$PLATFORM" == "discord" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "📱 Discord Setup"
    echo "----------------"
    echo "You need to register slash commands with Discord."
    echo ""
    read -p "Register Discord commands now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Enter your Discord Application ID:"
        read APP_ID
        echo "Enter your Discord Bot Token:"
        read -s BOT_TOKEN
        echo ""
        
        echo "Registering commands..."
        DISCORD_TOKEN=$BOT_TOKEN APPLICATION_ID=$APP_ID node scripts/register-discord-commands.js
        echo -e "${GREEN}✓ Discord commands registered${NC}"
    fi
fi

if [[ "$PLATFORM" == "slack" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "💬 Slack Setup"
    echo "---------------"
    echo "You need to set up your Slack workspace."
    echo ""
    read -p "Set up Slack workspace now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Running Slack workspace setup..."
        node scripts/setup-slack-workspace.js
        echo -e "${GREEN}✓ Slack workspace configured${NC}"
    fi
fi

# Final Steps
echo ""
echo "📋 Final Steps"
echo "-------------"

if [[ "$PLATFORM" == "discord" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "📱 Discord:"
    echo "1. Copy your Worker URL from the deployment output above"
    echo "2. Go to Discord Developer Portal → General Information"
    echo "3. Set 'Interactions Endpoint URL' to:"
    echo "   https://YOUR-WORKER.workers.dev/discord/interactions"
    echo "4. Save and verify (Discord will ping your endpoint)"
    echo ""
    echo "5. Invite your bot to a server with this URL:"
    echo "   https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2147483648&scope=bot%20applications.commands"
    echo ""
fi

if [[ "$PLATFORM" == "slack" ]] || [[ "$PLATFORM" == "both" ]]; then
    echo ""
    echo "💬 Slack:"
    echo "1. Go to https://api.slack.com/apps → Your App"
    echo "2. Go to Slash Commands → Edit /nfl"
    echo "3. Update Request URL to:"
    echo "   https://YOUR-WORKER.workers.dev/slack/commands"
    echo "4. Save"
    echo "5. Test in any Slack channel: /nfl help"
    echo ""
fi

echo ""
echo "🔧 Make yourself an admin:"
echo "   - Run any command to create your player record"
echo "   - Then run: wrangler d1 execute nfl-loser-pickem-db --remote --command=\"SELECT * FROM players\""
echo "   - Note your player_id, then run:"
echo "   - wrangler d1 execute nfl-loser-pickem-db --remote --command=\"UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID\""
echo ""
echo "7. Test admin commands:"
echo "   /nfl admin sync 1"
echo "   /nfl admin open-week 1"
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "See docs/DEPLOYMENT_CHECKLIST.md for detailed verification steps."
