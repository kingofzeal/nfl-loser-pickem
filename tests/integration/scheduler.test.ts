/**
 * SchedulerService Integration Tests
 * 
 * Tests the scheduler service with real database operations
 */

import { SchedulerService } from '../../src/services/SchedulerService';
import { WeekService } from '../../src/services/WeekService';
import { GameService } from '../../src/services/GameService';
import { ESPNDataProvider } from '../../src/services/providers/ESPNDataProvider';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { Database } from '../../src/database/Database';
import BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SchedulerService Integration Tests', () => {
  let db: Database;
  let schedulerService: SchedulerService;
  let weekService: WeekService;
  let gameService: GameService;
  let sqliteDb: BetterSqlite3.Database;

  beforeAll(() => {
    // Create in-memory SQLite database
    sqliteDb = new BetterSqlite3(':memory:');

    // Run migrations
    const migrationFiles = [
      '0001_create_teams.sql',
      '0002_create_seasons_weeks_games.sql',
      '0003_create_workspaces_players.sql',
      '0004_create_picks_standings.sql',
      '0005_create_audit_log.sql',
    ];

    for (const file of migrationFiles) {
      const sql = readFileSync(join(__dirname, '../../migrations', file), 'utf-8');
      sqliteDb.exec(sql);
    }

    // Create mock D1Database that uses better-sqlite3
    const mockD1: any = {
      prepare: (query: string) => {
        const stmt = sqliteDb.prepare(query);
        return {
          bind: (...params: any[]) => ({
            all: async () => {
              try {
                const results = stmt.all(...params);
                return { success: true, results };
              } catch (error) {
                return { success: false, results: [] };
              }
            },
            first: async () => {
              try {
                const result = stmt.get(...params);
                return result || null;
              } catch (error) {
                return null;
              }
            },
            run: async () => {
              try {
                const info = stmt.run(...params);
                return { 
                  success: true, 
                  meta: { 
                    last_row_id: info.lastInsertRowid,
                    changes: info.changes 
                  } 
                };
              } catch (error) {
                return { success: false };
              }
            },
          }),
          all: async () => {
            try {
              const results = stmt.all();
              return { success: true, results };
            } catch (error) {
              return { success: false, results: [] };
            }
          },
          first: async () => {
            try {
              const result = stmt.get();
              return result || null;
            } catch (error) {
              return null;
            }
          },
          run: async () => {
            try {
              const info = stmt.run();
              return { 
                success: true, 
                meta: { 
                  last_row_id: info.lastInsertRowid,
                  changes: info.changes 
                } 
              };
            } catch (error) {
              return { success: false };
            }
          },
        };
      },
      batch: async (statements: any[]) => {
        const results = [];
        for (const stmt of statements) {
          results.push(await stmt.run());
        }
        return results;
      },
    };

    // Initialize services
    db = new Database(mockD1);
    const auditService = new AuditService(db);
    const pickService = new PickService(db, auditService);
    weekService = new WeekService(db, auditService, pickService);
  gameService = new GameService(db, auditService, new ESPNDataProvider());
    schedulerService = new SchedulerService(db, weekService, gameService);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  beforeEach(() => {
    // Clear data between tests
    sqliteDb.exec('DELETE FROM audit_log');
    sqliteDb.exec('DELETE FROM picks');
    sqliteDb.exec('DELETE FROM standings');
    sqliteDb.exec('DELETE FROM games');
    sqliteDb.exec('DELETE FROM weeks');
    sqliteDb.exec('DELETE FROM seasons');
    sqliteDb.exec('DELETE FROM players');
    sqliteDb.exec('DELETE FROM workspaces');
  });

  describe('openWeeksIfNeeded', () => {
    it('should open weeks that are scheduled and past open_at time', async () => {
      // Create season
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      // Create week that should be opened (open_at in the past)
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const week = await db.weeks.create({
        season_id: season.season_id,
        week_number: 1,
        state: 'scheduled',
        open_at: pastDate,
        close_at: null,
      });

      await schedulerService.openWeeksIfNeeded();

      const updatedWeek = await db.weeks.findById(week.week_id);
      expect(updatedWeek?.state).toBe('open');
    });

    it('should not open weeks with future open_at time', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      const futureDate = new Date(Date.now() + 86400000); // 1 day from now
      const week = await db.weeks.create({
        season_id: season.season_id,
        week_number: 1,
        state: 'scheduled',
        open_at: futureDate,
        close_at: null,
      });

      await schedulerService.openWeeksIfNeeded();

      const updatedWeek = await db.weeks.findById(week.week_id);
      expect(updatedWeek?.state).toBe('scheduled');
    });
  });

  describe('syncGames', () => {
    it('should sync games for open and in_progress weeks', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      const week = await db.weeks.create({
        season_id: season.season_id,
        week_number: 1,
        state: 'open',
        open_at: new Date(),
        close_at: null,
      });

      // Mock game sync (would normally call ESPN API)
      jest.spyOn(gameService, 'syncGames').mockResolvedValue(undefined);

      await schedulerService.syncGames();

      expect(gameService.syncGames).toHaveBeenCalledWith(week.week_id);
    });
  });

  describe('finalizeWeeksIfNeeded', () => {
    it('should finalize weeks when all games are complete', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const week = await db.weeks.create({
        season_id: season.season_id,
        week_number: 1,
        state: 'in_progress',
        open_at: new Date(Date.now() - 86400000),
        close_at: pastDate,
      });

      // Mock all games final
      jest.spyOn(db.games, 'allFinalForWeek').mockResolvedValue(true);
      jest.spyOn(weekService, 'finalizeWeek').mockResolvedValue(week);

      await schedulerService.finalizeWeeksIfNeeded();

      expect(weekService.finalizeWeek).toHaveBeenCalledWith(week.week_id);
    });

    it('should not finalize weeks if games are not complete', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      const pastDate = new Date(Date.now() - 3600000);
      const week = await db.weeks.create({
        season_id: season.season_id,
        week_number: 1,
        state: 'in_progress',
        open_at: new Date(Date.now() - 86400000),
        close_at: pastDate,
      });

      jest.spyOn(db.games, 'allFinalForWeek').mockResolvedValue(false);
      jest.spyOn(weekService, 'finalizeWeek').mockResolvedValue(week);

      await schedulerService.finalizeWeeksIfNeeded();

      expect(weekService.finalizeWeek).not.toHaveBeenCalled();
    });
  });

  describe('runScheduledJobs', () => {
    it('should run all scheduled jobs without error', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'active',
      });

      jest.spyOn(gameService, 'syncGames').mockResolvedValue(undefined);

      await expect(schedulerService.runScheduledJobs()).resolves.not.toThrow();
    });
  });
});
