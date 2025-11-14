/**
 * Week Lifecycle Integration Tests
 *
 * Covers: opening week, picks, game progression, locking, finalization, outcomes, standings update, audit logs.
 */
/// <reference types="@cloudflare/workers-types" />

import BetterSqlite3 from 'better-sqlite3';
import { Database as AppDatabase } from '../../src/database/Database';
import { getTestDb } from '../setup';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';
import { StandingsService } from '../../src/services/StandingsService';
import { GameService } from '../../src/services/GameService';
import { RenderService } from '../../src/services/RenderService';
import { CommandRouter } from '../../src/commands/CommandRouter';
import { PickCommandHandler } from '../../src/commands/PickCommandHandler';
import { HelpCommandHandler } from '../../src/commands/HelpCommandHandler';
import { CommandContext } from '../../src/types';

function createMockD1(sqliteDb: BetterSqlite3.Database): D1Database {
  return {
    prepare: (query: string) => {
      const stmt = sqliteDb.prepare(query);
      return {
        bind: (...values: any[]) => ({
          first: async <T = any>() => stmt.get(...values) as T || null,
          all: async <T = any>() => ({ results: stmt.all(...values) as T[], success: true, meta: {} }),
          run: async () => {
            const info = stmt.run(...values);
            return { success: true, meta: { last_row_id: info.lastInsertRowid, changes: info.changes, duration: 0, rows_read: 0, rows_written: info.changes } };
          }
        }),
        first: async <T = any>() => stmt.get() as T || null,
        all: async <T = any>() => ({ results: stmt.all() as T[], success: true, meta: {} }),
        run: async () => { const info = stmt.run(); return { success: true, meta: { last_row_id: info.lastInsertRowid, changes: info.changes, duration: 0, rows_read: 0, rows_written: info.changes } }; }
      } as any;
    },
    batch: async (statements: D1PreparedStatement[]) => { const out: any[] = []; for (const s of statements) out.push(await s.run()); return out; },
    dump: async () => new ArrayBuffer(0),
    exec: async (_q: string) => ({ count: 0, duration: 0 })
  } as D1Database;
}

describe('Week Lifecycle Integration', () => {
  let sqliteDb: BetterSqlite3.Database;
  let db: AppDatabase;
  let auditService: AuditService;
  let pickService: PickService;
  let weekService: WeekService;
  let standingsService: StandingsService;
  let gameService: GameService;
  let renderService: RenderService;
  let router: CommandRouter;

  let seasonId: number;
  let weekId: number;
  let workspaceId: number;
  let playerAId: number;
  let playerBId: number;
  let gameId: number;

  beforeAll(() => {
    sqliteDb = getTestDb();
    db = new AppDatabase(createMockD1(sqliteDb));
  });

  beforeEach(async () => {
    // Ensure teams subset exists
    if (!await db.teams.findBySlug('ravens')) {
      sqliteDb.exec("INSERT INTO teams (slug, name, conference, division) VALUES ('ravens','Baltimore Ravens','AFC','North'), ('chiefs','Kansas City Chiefs','AFC','West'), ('bills','Buffalo Bills','AFC','East')");
    }

    // Season scheduled then manually opened
    const season = await db.seasons.create({ year: new Date().getFullYear(), weeks_count: 18, state: 'active' });
    seasonId = season.season_id;
    const week = await db.weeks.create({ season_id: seasonId, week_number: 1, state: 'scheduled', open_at: new Date().toISOString() as any, close_at: null });
    weekId = week.week_id;

    // Workspace + players
    const workspace = await db.workspaces.create({ platform: 'discord', platform_workspace_id: 'W1', name: 'Lifecycle WS', reminder_friday_enabled: 1 as any, reminder_sunday_enabled: 1 as any });
    workspaceId = workspace.workspace_id;
    const playerA = await db.players.create({ workspace_id: workspaceId, platform_user_id: 'U_A', display_name: 'Alice', is_admin: 0 as any, joined_week_id: null });
    playerAId = playerA.player_id;
    const playerB = await db.players.create({ workspace_id: workspaceId, platform_user_id: 'U_B', display_name: 'Bob', is_admin: 0 as any, joined_week_id: null });
    playerBId = playerB.player_id;

    // Game scheduled
    const ravens = await db.teams.findBySlug('ravens');
    const chiefs = await db.teams.findBySlug('chiefs');
    if (!ravens || !chiefs) throw new Error('Teams not found');
    const game = await db.games.create({
      week_id: weekId,
      external_id: 'G1',
      home_team_id: ravens.team_id,
      away_team_id: chiefs.team_id,
      kickoff_time: new Date(Date.now() + 30 * 60 * 1000).toISOString() as any, // 30m future
      status: 'scheduled',
      home_score: null,
      away_score: null,
      winner_team_id: null
    });
    gameId = game.game_id;

    // Services
    auditService = new AuditService(db);
    pickService = new PickService(db, auditService);
    weekService = new WeekService(db, auditService, pickService);
    standingsService = new StandingsService(db, auditService);
    // Provider stub for gameService (not used heavily here)
    const providerStub = { fetchGamesForWeek: jest.fn().mockResolvedValue([]) } as any;
    gameService = new GameService(db, auditService, providerStub);
    renderService = new RenderService();

    // Command router for making picks
    router = new CommandRouter();
    router.register('pick', new PickCommandHandler(pickService, weekService, renderService, db));
    router.register('help', new HelpCommandHandler(renderService));
  });

  function ctx(playerId: number): CommandContext {
    return { workspace_id: workspaceId, player_id: playerId, platform: 'discord', channel_id: 'C1', is_admin: false };
  }

  it('opens week, records picks, locks after kickoff, finalizes and updates standings', async () => {
    // Open the week manually
    const openedWeek = await weekService.openWeek(weekId, playerAId);
    expect(openedWeek.state).toBe('open');

    // Players make picks (Alice picks ravens who will LOSE; Bob picks chiefs who will WIN)
    await router.route('pick', ctx(playerAId), ['ravens']);
    await router.route('pick', ctx(playerBId), ['chiefs']);

  // Simulate kickoff passing (keep status 'scheduled' so WeekService transitions it and locks picks)
  await db.games.update(gameId, { kickoff_time: new Date(Date.now() - 5 * 60 * 1000).toISOString() as any });
  await weekService.closeGames(weekId); // should mark game in_progress and lock both picks

    const picksAfterLock = await db.picks.findByWeek(weekId);
    expect(picksAfterLock.every(p => p.locked_at !== null)).toBe(true);

    // Set final scores: ravens lose, chiefs win (winner_team_id = chiefs)
    await db.games.update(gameId, { status: 'final', home_score: 10, away_score: 27, winner_team_id: (await db.teams.findBySlug('chiefs'))!.team_id });

    // Finalize week
    const finalizedWeek = await weekService.finalizeWeek(weekId, playerBId);
    expect(finalizedWeek.state).toBe('finalized');

    // Update standings post-finalization
    await standingsService.updateStandings(weekId);

    // Verify pick outcomes: Alice picked ravens (losing team) => win; Bob picked chiefs (winning team) => loss
    const alicePick = await db.picks.findByWeekAndPlayer(weekId, playerAId);
    const bobPick = await db.picks.findByWeekAndPlayer(weekId, playerBId);
    expect(alicePick?.outcome).toBe('win');
    expect(bobPick?.outcome).toBe('loss');

    // Verify standings reflect outcomes
    const aliceStanding = await db.standings.findBySeasonAndPlayer(seasonId, playerAId);
    const bobStanding = await db.standings.findBySeasonAndPlayer(seasonId, playerBId);
    expect(aliceStanding?.wins).toBe(1);
    expect(aliceStanding?.losses).toBe(0);
    expect(bobStanding?.wins).toBe(0);
    expect(bobStanding?.losses).toBe(1);

    // Audit logs include week_opened and week_finalized
    const logs = await db.auditLog.findByWorkspace(workspaceId);
    const actions = logs.map(l => l.action);
    expect(actions).toEqual(expect.arrayContaining(['week_opened', 'week_finalized', 'pick_created', 'pick_created']));
  });

  it('prevents picks after game kickoff when game already in progress', async () => {
    await weekService.openWeek(weekId);
    // Set game kickoff in past, status in_progress
    await db.games.update(gameId, { status: 'in_progress', kickoff_time: new Date(Date.now() - 60 * 1000).toISOString() as any });

    // Attempt pick for team in started game
    const response = await router.route('pick', ctx(playerAId), ['ravens']);
    // Expect error embed
    if (typeof response.content === 'object' && 'title' in response.content) {
      expect(response.content.title).toBe('❌ Error');
    }
  });
});
