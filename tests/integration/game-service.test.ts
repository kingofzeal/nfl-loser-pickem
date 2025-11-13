/**
 * GameService Integration Tests
 * Tests ESPN API integration, game syncing, and data updates
 */

/// <reference types="@cloudflare/workers-types" />

import BetterSqlite3 from 'better-sqlite3';
import { GameService } from '../../src/services/GameService';
import { AuditService } from '../../src/services/AuditService';
import { Database as AppDatabase } from '../../src/database/Database';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Create a mock D1Database interface from better-sqlite3
 */
function createMockD1(sqliteDb: BetterSqlite3.Database): D1Database {
  return {
    prepare: (query: string) => {
      const stmt = sqliteDb.prepare(query);
      
      return {
        bind: (...values: any[]) => ({
          first: async <T = any>() => {
            try {
              return stmt.get(...values) as T || null;
            } catch (error) {
              throw error;
            }
          },
          all: async <T = any>() => {
            try {
              const results = stmt.all(...values) as T[];
              return { results, success: true, meta: {} };
            } catch (error) {
              return { results: [] as T[], success: false, meta: {} };
            }
          },
          run: async () => {
            try {
              const info = stmt.run(...values);
              return {
                success: true,
                meta: {
                  last_row_id: info.lastInsertRowid,
                  changes: info.changes,
                  duration: 0,
                  rows_read: 0,
                  rows_written: info.changes,
                },
              };
            } catch (error) {
              return {
                success: false,
                meta: {
                  last_row_id: 0,
                  changes: 0,
                  duration: 0,
                  rows_read: 0,
                  rows_written: 0,
                },
              };
            }
          },
        }),
        
        first: async <T = any>() => {
          try {
            return stmt.get() as T || null;
          } catch (error) {
            throw error;
          }
        },
        
        all: async <T = any>() => {
          try {
            const results = stmt.all() as T[];
            return { results, success: true, meta: {} };
          } catch (error) {
            return { results: [] as T[], success: false, meta: {} };
          }
        },
        
        run: async () => {
          try {
            const info = stmt.run();
            return {
              success: true,
              meta: {
                last_row_id: info.lastInsertRowid,
                changes: info.changes,
                duration: 0,
                rows_read: 0,
                rows_written: info.changes,
              },
            };
          } catch (error) {
            return {
              success: false,
              meta: {
                last_row_id: 0,
                changes: 0,
                duration: 0,
                rows_read: 0,
                rows_written: 0,
              },
            };
          }
        },
      } as any;
    },
    
    batch: async <T = any>(statements: D1PreparedStatement[]) => {
      const results: any[] = [];
      for (const stmt of statements) {
        try {
          const result = await stmt.run();
          results.push(result);
        } catch (error) {
          results.push({ success: false, meta: {} });
        }
      }
      return results;
    },
    
    dump: async () => new ArrayBuffer(0),
    exec: async (query: string) => ({ count: 0, duration: 0 }),
  } as D1Database;
}

describe('GameService Integration Tests', () => {
  let db: AppDatabase;
  let gameService: GameService;
  let auditService: AuditService;
  let sqlite: BetterSqlite3.Database;
  let mockD1: D1Database;

  beforeEach(async () => {
    // Create in-memory database
    sqlite = new BetterSqlite3(':memory:');
    mockD1 = createMockD1(sqlite);
    db = new AppDatabase(mockD1);

    // Run migrations
    const migrations = [
      '0001_create_teams.sql',
      '0002_create_seasons_weeks_games.sql',
      '0003_create_workspaces_players.sql',
      '0004_create_picks_standings.sql',
      '0005_create_audit_log.sql',
    ];

    for (const migration of migrations) {
      const sql = readFileSync(join(__dirname, '..', '..', 'migrations', migration), 'utf-8');
      sqlite.exec(sql);
    }

    // Initialize services
    auditService = new AuditService(db);
    gameService = new GameService(db, auditService);

    // Note: Teams are already seeded by 0001_create_teams.sql migration
  });

  afterEach(() => {
    sqlite.close();
  });

  async function createTestSeason() {
    const season = await db.seasons.create({ year: 2024, weeks_count: 18 });
    const week = await db.weeks.create({
      season_id: season.season_id,
      week_number: 1,
      state: 'open',
      open_at: new Date('2024-09-01T00:00:00Z') as any,
      close_at: new Date('2024-09-09T23:59:59Z') as any,
    });
    return { season, week };
  }

  describe('syncGames', () => {
    it('should fetch and create games from ESPN API', async () => {
      const { week } = await createTestSeason();

      // Mock fetch for ESPN API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          week: { number: 1 },
          events: [
            {
              id: '401547417',
              date: '2024-09-05T23:20Z',
              name: 'Kansas City Chiefs at Baltimore Ravens',
              status: {
                type: { name: 'STATUS_SCHEDULED' },
              },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: 'home',
                      team: { id: '33', abbreviation: 'BAL' },
                    },
                    {
                      homeAway: 'away',
                      team: { id: '12', abbreviation: 'KC' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      await gameService.syncGames(week.week_id);

      const games = await db.games.findByWeek(week.week_id);
      expect(games).toHaveLength(1);
      expect(games[0].external_id).toBe('401547417');
      expect(games[0].status).toBe('scheduled');
    });

    it('should update existing game with new scores', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      // Create existing game
      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2024-09-05T23:20Z'),
        status: 'in_progress',
        external_id: '401547417',
      });

      // Mock fetch with final scores
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          week: { number: 1 },
          events: [
            {
              id: '401547417',
              date: '2024-09-05T23:20Z',
              name: 'Kansas City Chiefs at Baltimore Ravens',
              status: {
                type: { name: 'STATUS_FINAL' },
              },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: 'home',
                      team: { id: '33', abbreviation: 'BAL' },
                      score: '20',
                    },
                    {
                      homeAway: 'away',
                      team: { id: '12', abbreviation: 'KC' },
                      score: '27',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      await gameService.syncGames(week.week_id);

      const games = await db.games.findByWeek(week.week_id);
      expect(games).toHaveLength(1);
      expect(games[0].status).toBe('final');
      expect(games[0].home_score).toBe(20);
      expect(games[0].away_score).toBe(27);
      expect(games[0].winner_team_id).toBe(chiefs!.team_id);
    });

    it('should handle tie games correctly', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2024-09-05T23:20Z'),
        status: 'in_progress',
        external_id: '401547417',
      });

      // Mock fetch with tie score
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          week: { number: 1 },
          events: [
            {
              id: '401547417',
              date: '2024-09-05T23:20Z',
              name: 'Kansas City Chiefs at Baltimore Ravens',
              status: {
                type: { name: 'STATUS_FINAL' },
              },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: 'home',
                      team: { id: '33', abbreviation: 'BAL' },
                      score: '20',
                    },
                    {
                      homeAway: 'away',
                      team: { id: '12', abbreviation: 'KC' },
                      score: '20',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      await gameService.syncGames(week.week_id);

      const games = await db.games.findByWeek(week.week_id);
      expect(games[0].status).toBe('final');
      expect(games[0].home_score).toBe(20);
      expect(games[0].away_score).toBe(20);
      expect(games[0].winner_team_id).toBeNull(); // Tie
    });

    it('should handle ESPN API errors gracefully', async () => {
      const { week } = await createTestSeason();

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(gameService.syncGames(week.week_id)).rejects.toThrow(
        'Failed to sync games'
      );
    });

    it('should skip games with unknown teams', async () => {
      const { week } = await createTestSeason();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          week: { number: 1 },
          events: [
            {
              id: '401547418',
              date: '2024-09-05T23:20Z',
              name: 'Unknown Team vs Another Unknown',
              status: {
                type: { name: 'STATUS_SCHEDULED' },
              },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: 'home',
                      team: { id: '999', abbreviation: 'UNK' }, // Unknown team
                    },
                    {
                      homeAway: 'away',
                      team: { id: '998', abbreviation: 'UNK2' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      await gameService.syncGames(week.week_id);

      const games = await db.games.findByWeek(week.week_id);
      expect(games).toHaveLength(0); // Should skip unknown teams
    });
  });

  describe('updateGameStatus', () => {
    it('should update game status and determine winner', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      const game = await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2024-09-05T23:20Z'),
        status: 'scheduled',
        external_id: '401547417',
      });

      const updatedGame = await gameService.updateGameStatus(
        game.game_id,
        'final',
        { home: 20, away: 27 }
      );

      expect(updatedGame.status).toBe('final');
      expect(updatedGame.home_score).toBe(20);
      expect(updatedGame.away_score).toBe(27);
      expect(updatedGame.winner_team_id).toBe(chiefs!.team_id);
    });
  });

  describe('getGamesForWeek', () => {
    it('should return games with team details', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2024-09-05T23:20Z'),
        status: 'final',
        home_score: 20,
        away_score: 27,
        winner_team_id: chiefs!.team_id,
        external_id: '401547417',
      });

      const games = await gameService.getGamesForWeek(week.week_id);

      expect(games).toHaveLength(1);
      expect(games[0].home_team.slug).toBe('ravens');
      expect(games[0].away_team.slug).toBe('chiefs');
      expect(games[0].winner_team?.slug).toBe('chiefs');
    });
  });

  describe('hasWeekStarted', () => {
    it('should return true if any game has kicked off', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      // Game in the past
      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2020-09-05T23:20Z'), // Past
        status: 'scheduled',
        external_id: '401547417',
      });

      const started = await gameService.hasWeekStarted(week.week_id);
      expect(started).toBe(true);
    });

    it('should return false if no games have kicked off', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');

      // Game in the future
      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2030-09-05T23:20Z'), // Future
        status: 'scheduled',
        external_id: '401547417',
      });

      const started = await gameService.hasWeekStarted(week.week_id);
      expect(started).toBe(false);
    });
  });

  describe('getGamesToLock', () => {
    it('should return games that have kicked off but are still scheduled', async () => {
      const { week } = await createTestSeason();
      const chiefs = await db.teams.findBySlug('chiefs');
      const ravens = await db.teams.findBySlug('ravens');
      const eagles = await db.teams.findBySlug('eagles');
      const packers = await db.teams.findBySlug('packers');

      // Game that should be locked (past kickoff, still scheduled)
      await db.games.create({
        week_id: week.week_id,
        home_team_id: ravens!.team_id,
        away_team_id: chiefs!.team_id,
        kickoff_time: new Date('2020-09-05T23:20Z'),
        status: 'scheduled',
        external_id: '401547417',
      });

      // Game that shouldn't be locked (future kickoff)
      await db.games.create({
        week_id: week.week_id,
        home_team_id: eagles!.team_id,
        away_team_id: packers!.team_id,
        kickoff_time: new Date('2030-09-08T17:00Z'),
        status: 'scheduled',
        external_id: '401547418',
      });

      const gamesToLock = await gameService.getGamesToLock(week.week_id);

      expect(gamesToLock).toHaveLength(1);
      expect(gamesToLock[0].external_id).toBe('401547417');
    });
  });
});
