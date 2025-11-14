/**
 * Database Integration Tests
 * 
 * Uses better-sqlite3 for local testing with SQLite migrations.
 * Tests the Database class with a mock D1Database interface.
 */

/// <reference types="@cloudflare/workers-types" />

import BetterSqlite3 from 'better-sqlite3';
import { Database as AppDatabase } from '../../src/database/Database';
import { getTestDb, resetTestDb } from '../setup';
import { Team, Season, Week, Game, Workspace, Player, Pick, Standing } from '../../src/types';

/**
 * Create a mock D1Database interface from better-sqlite3
 * This allows testing D1 code locally
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
      // Simulate batch execution
      const results: any[] = [];
      
      for (const stmt of statements) {
        try {
          const result = await stmt.run();
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            meta: {
              last_row_id: 0,
              changes: 0,
              duration: 0,
              rows_read: 0,
              rows_written: 0,
              size_after: 0,
              changed_db: false,
            },
          });
        }
      }
      
      return results;
    },
    
    dump: async () => new ArrayBuffer(0),
    exec: async (query: string) => ({ count: 0, duration: 0 }),
  } as D1Database;
}

describe('Database Integration', () => {
  let sqliteDb: BetterSqlite3.Database;
  let db: AppDatabase;

  beforeAll(() => {
    sqliteDb = getTestDb();
    const mockD1 = createMockD1(sqliteDb);
    db = new AppDatabase(mockD1);
  });

  afterEach(() => {
    resetTestDb();
  });

  describe('Connection', () => {
    it('should execute basic query', async () => {
      const result = await db.query<{ result: number }>('SELECT 1 as result');
      expect(result[0].result).toBe(1);
    });
  });

  describe('Teams', () => {
    beforeEach(() => {
      // Seed minimal team data for each test (resetTestDb clears tables after each test)
      sqliteDb.exec(`
        INSERT INTO teams (team_id, slug, name, conference, division) VALUES
        (1, 'chiefs', 'Kansas City Chiefs', 'AFC', 'West'),
        (2, 'bills', 'Buffalo Bills', 'AFC', 'East')
      `);
    });

    it('should find all teams', async () => {
      const teams = await db.teams.findAll();
      expect(teams.length).toBeGreaterThan(0);
    });

    it('should find team by ID', async () => {
      const team = await db.teams.findById(1);
      expect(team).not.toBeNull();
      expect(team?.team_id).toBe(1);
    });

    it('should find team by slug', async () => {
      const team = await db.teams.findBySlug('chiefs');
      expect(team).not.toBeNull();
      expect(team?.slug).toBe('chiefs');
    });
  });

  describe('Seasons', () => {
    it('should create a season', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'upcoming',
      });
      expect(season.season_id).toBeDefined();
      expect(season.year).toBe(2025);
    });

    it('should find season by year', async () => {
      await db.seasons.create({ year: 2024, weeks_count: 18, state: 'active' });
      const season = await db.seasons.findByYear(2024);
      expect(season).not.toBeNull();
      expect(season?.year).toBe(2024);
    });

    it('should update season', async () => {
      const created = await db.seasons.create({ year: 2023, weeks_count: 18, state: 'upcoming' });
      const updated = await db.seasons.update(created.season_id, { state: 'active' });
      expect(updated.state).toBe('active');
    });
  });

  describe('Weeks', () => {
    let testSeasonId: number;

    beforeEach(async () => {
      const season = await db.seasons.create({
        year: 2024,
        weeks_count: 18,
        state: 'active',
      });
      testSeasonId = season.season_id;
    });

    it('should create a week', async () => {
      const week = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date('2024-09-05T12:00:00Z'),
        close_at: null,
      });
      expect(week.week_id).toBeDefined();
      expect(week.week_number).toBe(1);
    });

    it('should find weeks by season', async () => {
      await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date('2024-09-05T12:00:00Z'),
        close_at: null,
      });
      
      const weeks = await db.weeks.findBySeason(testSeasonId);
      expect(weeks.length).toBeGreaterThan(0);
    });

    it('should find week by season and number', async () => {
      await db.weeks.create({
        season_id: testSeasonId,
        week_number: 2,
        state: 'scheduled',
        open_at: null,
        close_at: null,
      });
      
      const week = await db.weeks.findBySeasonAndNumber(testSeasonId, 2);
      expect(week).not.toBeNull();
      expect(week?.week_number).toBe(2);
    });

    it('should update week', async () => {
      const created = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 3,
        state: 'scheduled',
        open_at: null,
        close_at: null,
      });
      
      const updated = await db.weeks.update(created.week_id, { state: 'in_progress' });
      expect(updated.state).toBe('in_progress');
    });
  });

  describe('Workspaces and Players', () => {
    let testWorkspaceId: number;

    it('should create a workspace', async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T12345678',
        name: 'Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      expect(workspace.workspace_id).toBeDefined();
      testWorkspaceId = workspace.workspace_id;
    });

    it('should find workspace by platform ID', async () => {
      await db.workspaces.create({
        platform: 'discord',
        platform_workspace_id: 'D87654321',
        name: 'Discord Workspace',
        reminder_friday_enabled: false,
        reminder_sunday_enabled: true,
      });
      
      const workspace = await db.workspaces.findByPlatformId('discord', 'D87654321');
      expect(workspace).not.toBeNull();
      expect(workspace?.platform).toBe('discord');
    });

    it('should update workspace', async () => {
      const created = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T99999999',
        name: 'Update Test',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      
      const updated = await db.workspaces.update(created.workspace_id, {
        name: 'Updated Name',
      });
      expect(updated.name).toBe('Updated Name');
    });

    it('should create a player', async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T11111111',
        name: 'Player Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      
      const player = await db.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: 'U12345678',
        display_name: 'Test Player',
        is_admin: true,
        joined_week_id: null,
      });
      expect(player.player_id).toBeDefined();
      expect(player.display_name).toBe('Test Player');
    });

    it('should find players by workspace', async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T22222222',
        name: 'Multi Player Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      
      await db.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: 'U1',
        display_name: 'Player 1',
        is_admin: false,
        joined_week_id: null,
      });
      
      await db.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: 'U2',
        display_name: 'Player 2',
        is_admin: false,
        joined_week_id: null,
      });
      
      const players = await db.players.findByWorkspace(workspace.workspace_id);
      expect(players.length).toBe(2);
    });
  });

  describe('Picks', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;
    let testSeasonId: number;
    let testWeekId: number;
    let testTeamId: number;

    beforeEach(async () => {
      // Setup test data (seed a test team each time since resetTestDb clears tables)
      sqliteDb.exec(`INSERT INTO teams (team_id, slug, name, conference, division) VALUES (10, 'test', 'Test Team', 'AFC', 'East')`);
      testTeamId = 10;
      
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T_PICK_TEST',
        name: 'Pick Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U_PICK_TEST',
        display_name: 'Pick Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;

      const season = await db.seasons.create({ year: 2022, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;

      const week = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date('2022-09-08T12:00:00Z'),
        close_at: null,
      });
      testWeekId = week.week_id;
    });

    it('should create a pick', async () => {
      const pick = await db.picks.create({
        week_id: testWeekId,
        player_id: testPlayerId,
        team_id: testTeamId,
        source: 'manual',
        locked_at: null,
        outcome: null,
      });
      expect(pick.pick_id).toBeDefined();
    });

    it('should find pick by week and player', async () => {
      await db.picks.create({
        week_id: testWeekId,
        player_id: testPlayerId,
        team_id: testTeamId,
        source: 'manual',
        locked_at: null,
        outcome: null,
      });
      
      const pick = await db.picks.findByWeekAndPlayer(testWeekId, testPlayerId);
      expect(pick).not.toBeNull();
    });

    it('should update pick', async () => {
      const created = await db.picks.create({
        week_id: testWeekId,
        player_id: testPlayerId,
        team_id: testTeamId,
        source: 'manual',
        locked_at: null,
        outcome: null,
      });
      
      const updated = await db.picks.update(created.pick_id, {
        outcome: 'win',
      });
      expect(updated.outcome).toBe('win');
    });

    it('should delete pick', async () => {
      const created = await db.picks.create({
        week_id: testWeekId,
        player_id: testPlayerId,
        team_id: testTeamId,
        source: 'manual',
        locked_at: null,
        outcome: null,
      });
      
      await db.picks.delete(created.pick_id);
      const pick = await db.picks.findById(created.pick_id);
      expect(pick).toBeNull();
    });
  });

  describe('Standings', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;
    let testSeasonId: number;

    beforeEach(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T_STANDING_TEST',
        name: 'Standing Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U_STANDING_TEST',
        display_name: 'Standing Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;

      const season = await db.seasons.create({ year: 2021, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;
    });

    it('should create standings', async () => {
      const standing = await db.standings.create({
        season_id: testSeasonId,
        player_id: testPlayerId,
        wins: 5,
        losses: 3,
      });
      expect(standing.standing_id).toBeDefined();
      expect(standing.wins).toBe(5);
    });

    it('should find standings by season and player', async () => {
      await db.standings.create({
        season_id: testSeasonId,
        player_id: testPlayerId,
        wins: 5,
        losses: 3,
      });
      
      const standing = await db.standings.findBySeasonAndPlayer(testSeasonId, testPlayerId);
      expect(standing).not.toBeNull();
      expect(standing?.wins).toBe(5);
    });

    it('should update standings', async () => {
      const created = await db.standings.create({
        season_id: testSeasonId,
        player_id: testPlayerId,
        wins: 5,
        losses: 3,
      });
      
      const updated = await db.standings.update(created.standing_id, {
        wins: 6,
        losses: 3,
      });
      expect(updated.wins).toBe(6);
    });
  });

  describe('Audit Log', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;

    beforeEach(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T_AUDIT_TEST',
        name: 'Audit Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U_AUDIT_TEST',
        display_name: 'Audit Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;
    });

    it('should create audit log entry with JSON payload', async () => {
      const log = await db.auditLog.create({
        workspace_id: testWorkspaceId,
        actor_type: 'player',
        actor_id: testPlayerId,
        action: 'pick_created',
        entity_type: 'pick',
        entity_id: 123,
        payload: { team: 'chiefs', week: 1 },
      });
      expect(log.log_id).toBeDefined();
      expect(log.payload).toEqual({ team: 'chiefs', week: 1 });
    });

    it('should find audit logs by workspace', async () => {
      await db.auditLog.create({
        workspace_id: testWorkspaceId,
        actor_type: 'system',
        actor_id: null,
        action: 'week_locked',
        entity_type: 'week',
        entity_id: 1,
        payload: null,
      });
      
      const logs = await db.auditLog.findByWorkspace(testWorkspaceId);
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
