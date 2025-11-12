# Database Setup and Testing Guide

## Prerequisites

- PostgreSQL 14+ installed and running
- Node.js 22+ installed
- Environment variables configured

## Environment Setup

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/nfl_pickem

# For testing (optional separate database)
DATABASE_URL_TEST=postgresql://username:password@localhost:5432/nfl_pickem_test
```

## Initial Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE nfl_pickem;

# Create test database (optional)
CREATE DATABASE nfl_pickem_test;
```

### 2. Run Migrations

```bash
# Run all migrations
npm run migrate:up

# Check migration status
npx node-pg-migrate list
```

### 3. Seed Teams

```bash
# Seed all 32 NFL teams
npm run seed:teams
```

### 4. Create Test Season (Optional)

```bash
# Create 2025 season with 18 weeks
npm run seed:season -- --year 2025

# Or specify different year
npm run seed:season -- --year 2024
```

## Running Tests

### Integration Tests

Integration tests require a running PostgreSQL instance:

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm test tests/integration/database.test.ts

# Watch mode
npm run test:watch
```

### Test Coverage

The integration tests cover:
- ✅ Database connection
- ✅ All team operations (find all, by ID, by slug)
- ✅ Season CRUD operations
- ✅ Week CRUD operations
- ✅ Game CRUD operations and status checks
- ✅ Workspace CRUD operations
- ✅ Player CRUD operations
- ✅ Pick full CRUD with season queries
- ✅ Standings CRUD operations
- ✅ Audit log operations
- ✅ Transaction commit and rollback

## Migration Management

### Create New Migration

```bash
npm run migrate:create add_new_feature
```

### Rollback Migrations

```bash
# Rollback last migration
npm run migrate:down

# Rollback specific number of migrations
npm run migrate:down -- -n 2
```

### Testing Rollback

To test that migrations can be rolled back cleanly:

```bash
# 1. Apply all migrations
npm run migrate:up

# 2. Seed data
npm run seed:teams
npm run seed:season -- --year 2025

# 3. Rollback all migrations
npm run migrate:down -- -n 5

# 4. Re-apply migrations
npm run migrate:up

# 5. Verify data integrity
npm run seed:teams  # Should skip if data exists
```

## Database Schema

The database consists of 8 main tables:

### Global Tables
- **teams**: 32 NFL teams (AFC/NFC, divisions)
- **seasons**: NFL seasons by year
- **weeks**: 18 weeks per season with state tracking
- **games**: Game schedule, scores, and status

### Workspace-Scoped Tables
- **workspaces**: Slack/Discord workspace configurations
- **players**: Users within each workspace
- **picks**: Player picks for each week
- **standings**: Season standings per player
- **audit_log**: Action tracking and debugging

## Troubleshooting

### Connection Issues

```bash
# Test database connection
psql $DATABASE_URL

# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # macOS
```

### Migration Errors

If migrations fail:

```bash
# Check current migration state
npx node-pg-migrate list

# Force migration to specific version (use with caution)
npx node-pg-migrate up --to 001

# Reset database (WARNING: destroys all data)
psql -U postgres -c "DROP DATABASE nfl_pickem; CREATE DATABASE nfl_pickem;"
npm run migrate:up
```

### Test Database Cleanup

Integration tests create and clean up test data automatically. If tests are interrupted:

```bash
# Connect to database
psql $DATABASE_URL

# Clean up test data (workspaces with test IDs)
DELETE FROM workspaces WHERE platform_workspace_id LIKE 'T%';
DELETE FROM seasons WHERE year < 2020;
```

## Performance

### Connection Pooling

The database uses connection pooling with:
- Max connections: 10 (configurable via `DB_POOL_SIZE`)
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

### Indexes

All frequently queried columns have indexes:
- Foreign keys
- Platform IDs (workspaces, players)
- Status fields (games, weeks)
- External IDs (games)

## Production Considerations

### Backups

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore database
psql $DATABASE_URL < backup_20251112.sql
```

### Monitoring

Monitor these metrics:
- Connection pool usage
- Query execution time
- Index hit ratio
- Table size growth

### Scaling

For large deployments consider:
- Read replicas for reporting queries
- Partitioning audit_log by date
- Archiving completed seasons
- Connection pool size tuning
