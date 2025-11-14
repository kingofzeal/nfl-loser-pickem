/**
 * End-to-End Pick Workflow Integration Test
 *
 * Covers: /pick command end-to-end
 *  - Data seeding (season, week, game, workspace, player)
 *  - Command routing and handler execution
 *  - Pick creation & validation against week/game/team
 *  - Audit log entry creation
 *  - Duplicate pick prevention (same week)
 */

/// <reference types="@cloudflare/workers-types" />

import BetterSqlite3 from 'better-sqlite3';
import { Database as AppDatabase } from '../../src/database/Database';
import { getTestDb } from '../setup';
import { CommandRouter } from '../../src/commands/CommandRouter';
import { PickCommandHandler } from '../../src/commands/PickCommandHandler';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';
import { RenderService } from '../../src/services/RenderService';
import { CommandContext } from '../../src/types';

// Minimal D1 mock (pattern adapted from database.test.ts)
function createMockD1(sqliteDb: BetterSqlite3.Database): D1Database {
  return {
    prepare: (query: string) => {
      const stmt = sqliteDb.prepare(query);
      return {
        bind: (...values: any[]) => ({
          first: async <T = any>() => stmt.get(...values) as T || null,
          all: async <T = any>() => {
            const results = stmt.all(...values) as T[];
            return { results, success: true, meta: {} };
          },
          run: async () => {
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
          },
        }),
        first: async <T = any>() => stmt.get() as T || null,
        all: async <T = any>() => ({ results: stmt.all() as T[], success: true, meta: {} }),
        run: async () => {
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
        },
      } as any;
    },
    batch: async (statements: D1PreparedStatement[]) => {
      const results: any[] = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    dump: async () => new ArrayBuffer(0),
    exec: async (_q: string) => ({ count: 0, duration: 0 }),
  } as D1Database;
}

describe('Pick Workflow Integration', () => {
  let sqliteDb: BetterSqlite3.Database;
  let db: AppDatabase;
  let router: CommandRouter;
  let context: CommandContext;

  // Dynamic values created during setup
  let seasonId: number;
  let weekId: number;
  let playerId: number;
  let workspaceId: number;

  beforeAll(() => {
    sqliteDb = getTestDb();
    db = new AppDatabase(createMockD1(sqliteDb));
  });

  beforeEach(async () => {
    // Seed base data for current year season
    const currentYear = new Date().getFullYear();

    // Ensure required teams exist (resetTestDb clears teams between tests)
    const existingRavens = await db.teams.findBySlug('ravens');
    if (!existingRavens) {
      sqliteDb.exec("INSERT INTO teams (slug, name, conference, division) VALUES ('ravens','Baltimore Ravens','AFC','North'), ('chiefs','Kansas City Chiefs','AFC','West')");
    }

    // Season (active)
    const season = await db.seasons.create({ year: currentYear, weeks_count: 18, state: 'active' });
    seasonId = season.season_id;

    // Week (open)
    const week = await db.weeks.create({
      season_id: seasonId,
      week_number: 1,
      state: 'open',
      open_at: new Date().toISOString() as any,
      close_at: null,
    });
    weekId = week.week_id;

    // Workspace & Player
    const workspace = await db.workspaces.create({
      platform: 'discord',
      platform_workspace_id: 'W_TEST',
      name: 'Integration Test Workspace',
      reminder_friday_enabled: 1 as any,
      reminder_sunday_enabled: 1 as any,
    });
    workspaceId = workspace.workspace_id;

    const player = await db.players.create({
      workspace_id: workspaceId,
      platform_user_id: 'U_TEST',
      display_name: 'Test Player',
      is_admin: false,
      joined_week_id: null,
    });
    playerId = player.player_id;

    // Fetch required teams
    const ravens = await db.teams.findBySlug('ravens');
    const chiefs = await db.teams.findBySlug('chiefs');
    if (!ravens || !chiefs) throw new Error('Required teams not found after seeding');

    // Game (ravens vs chiefs) scheduled in future
    await db.games.create({
      week_id: weekId,
      external_id: 'GAME123',
      home_team_id: ravens.team_id,
      away_team_id: chiefs.team_id,
      kickoff_time: new Date(Date.now() + 60 * 60 * 1000).toISOString() as any, // 1 hour in future
      status: 'scheduled',
      home_score: null,
      away_score: null,
      winner_team_id: null,
    });

    // Build services
    const auditService = new AuditService(db);
    const pickService = new PickService(db, auditService);
    const weekService = new WeekService(db, auditService, pickService);
    const renderService = new RenderService();

    // Command router with real pick handler
    router = new CommandRouter();
    router.register('pick', new PickCommandHandler(pickService, weekService, renderService, db));

    // Command context
    context = {
      workspace_id: workspaceId,
      player_id: playerId,
      platform: 'discord',
      channel_id: 'C_TEST',
      is_admin: false,
    };
  });

  it('creates a pick successfully and returns confirmation', async () => {
    const response = await router.route('pick', context, ['ravens']);
    expect(response.type).toBe('ephemeral');
    if (typeof response.content === 'object') {
      expect(response.content).toHaveProperty('title', '✅ Pick Confirmed');
    }

    // Verify pick persisted
    const pick = await db.picks.findByWeekAndPlayer(weekId, playerId);
    expect(pick).not.toBeNull();

    // Verify audit log entry recorded
    const logs = await db.auditLog.findByWorkspace(context.workspace_id);
    const pickLog = logs.find(l => l.action === 'pick_created');
    expect(pickLog).toBeDefined();
    expect(pickLog?.payload).toMatchObject({ player_id: playerId, week_id: weekId });
  });

  it('prevents duplicate pick attempt for same week (change flow errors)', async () => {
    // First pick
    await router.route('pick', context, ['ravens']);

    // Second attempt same team
    const response = await router.route('pick', context, ['ravens']);
    expect(response.type).toBe('ephemeral');
    if (typeof response.content === 'object' && 'description' in response.content) {
      // Should expose validation error message from PickService
      expect((response.content as any).description).toMatch(/already have a pick/i);
    }

    // Ensure still only one pick in DB
    const allPicks = await db.picks.findByWeek(weekId);
    expect(allPicks.length).toBe(1);
  });
});
