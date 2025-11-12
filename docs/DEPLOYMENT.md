# NFL Loser Pick'em Bot - Deployment Guide

## Prerequisites

- Node.js 22+ (LTS recommended)
- PostgreSQL 14+
- Slack or Discord bot credentials
- Domain/hosting for webhooks (if not using websockets)

## Deployment Options

### Option 1: Traditional VPS (Digital Ocean, Linode, etc.)

1. **Provision Server**
   ```bash
   # Ubuntu 22.04 recommended
   sudo apt update
   sudo apt install -y postgresql nodejs npm git
   ```

2. **Clone Repository**
   ```bash
   git clone https://github.com/your-org/nfl-loser-pickem.git
   cd nfl-loser-pickem
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   nano .env
   ```

5. **Run Migrations**
   ```bash
   npm run migrate:up
   ```

6. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

7. **Setup Process Manager**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name nfl-pickem-bot
   pm2 startup
   pm2 save
   ```

---

### Option 2: AWS Lambda + RDS

1. **Setup RDS PostgreSQL**
   - Create RDS instance
   - Note connection string

2. **Package Lambda**
   ```bash
   npm run build
   zip -r function.zip dist/ node_modules/
   ```

3. **Create Lambda Function**
   - Runtime: Node.js 22.x
   - Upload function.zip
   - Set environment variables
   - Configure VPC access to RDS

4. **Setup EventBridge**
   - Create rules for cron jobs
   - Target: Lambda function

5. **Setup API Gateway** (for webhooks)
   - Create REST API
   - Integrate with Lambda
   - Deploy API

---

### Option 3: Vercel + Neon

1. **Fork Repository**

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Setup Neon Database**
   - Create Neon project
   - Copy connection string

4. **Configure Environment Variables**
   - Add to Vercel project settings
   - DATABASE_URL, bot tokens, etc.

5. **Setup Vercel Cron**
   - Create `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/open-week",
         "schedule": "0 9 * * 2"
       },
       {
         "path": "/api/cron/sync-games",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```

---

### Option 4: Docker

1. **Build Image**
   ```bash
   docker build -t nfl-pickem-bot .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

See `docker-compose.yml` for configuration.

---

## Post-Deployment

### 1. Verify Database Connection
```bash
npm run migrate:up
```

### 2. Seed Teams Data
Run migration 001 to populate teams table.

### 3. Create First Workspace
Admin must run initial setup command in Slack/Discord.

### 4. Seed Season Data
```
/nfl admin seed-season 2024
```

### 5. Test Commands
```
/nfl help
/nfl pick ravens
/nfl my
```

---

## Monitoring

### Health Check Endpoint
```
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 12345
}
```

### Logs
- Local: Check console or pm2 logs
- AWS: CloudWatch Logs
- Vercel: Vercel Logs dashboard

---

## Backup Strategy

### Database Backups
```bash
# Daily backup cron
0 2 * * * pg_dump $DATABASE_URL > backup-$(date +\%Y\%m\%d).sql
```

### Restore
```bash
psql $DATABASE_URL < backup-20241112.sql
```

---

## Scaling Considerations

- **Database:** Use connection pooling (pg.Pool)
- **Bot instances:** Can run multiple instances with load balancer
- **Image generation:** Offload to queue (BullMQ, SQS)
- **Caching:** Add Redis for frequently accessed data

---

## Security

- [ ] Store secrets in secure vault (AWS Secrets Manager, etc.)
- [ ] Enable database SSL
- [ ] Restrict database access by IP
- [ ] Rate limit bot commands
- [ ] Validate all user inputs
- [ ] Keep dependencies updated

---

## Troubleshooting

### Bot not responding
- Check bot token validity
- Verify webhook URL
- Check firewall/security groups

### Database connection errors
- Verify connection string
- Check network connectivity
- Ensure database is running

### Games not syncing
- Check ESPN API availability
- Verify sync cron is running
- Check logs for errors

---

## Cost Estimates

### VPS ($10-20/month)
- DigitalOcean Droplet: $12/month
- Managed PostgreSQL: $15/month
- **Total:** ~$27/month

### AWS ($15-30/month)
- Lambda: ~$2/month (free tier)
- RDS t3.micro: $15/month
- Data transfer: ~$3/month
- **Total:** ~$20/month

### Vercel + Neon ($0-25/month)
- Vercel: Free (Pro $20/month for teams)
- Neon: Free tier OK for <10 workspaces
- **Total:** $0-20/month

---

## Support

For issues or questions, open a GitHub issue or contact the maintainer.
