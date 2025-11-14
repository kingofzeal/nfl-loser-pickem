/**
 * RenderService Integration Test
 * Ensures weekly summary image generation returns a non-empty PNG buffer.
 * Satori and Resvg are mocked to avoid font dependencies in test environment.
 */
// Mock satori & resvg before imports
jest.mock('satori', () => ({ __esModule: true, default: jest.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"></svg>') }));
jest.mock('@resvg/resvg-js', () => ({ Resvg: class { constructor(_:any){} render(){ return { asPng: () => Buffer.from(new Uint8Array(6000)) }; } } }));
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../src/database/Database';
import { RenderService } from '../../src/services/RenderService';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';
import { StandingsService } from '../../src/services/StandingsService';

function mockD1(sqlite: BetterSqlite3.Database): D1Database {
  return {
    prepare: (q: string) => {
      const stmt = sqlite.prepare(q);
      return {
        bind: (...v: any[]) => ({
          all: async () => ({ success: true, results: stmt.all(...v) }),
          first: async () => stmt.get(...v) || null,
          run: async () => { const info = stmt.run(...v); return { success: true, meta: { last_row_id: info.lastInsertRowid, changes: info.changes } }; }
        }),
        all: async () => ({ success: true, results: stmt.all() }),
        first: async () => stmt.get() || null,
        run: async () => { const info = stmt.run(); return { success: true, meta: { last_row_id: info.lastInsertRowid, changes: info.changes } }; }
      } as any;
    },
    batch: async (stmts: any[]) => Promise.all(stmts.map(s => s.run())),
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 })
  } as any;
}

describe('RenderService weekly summary image', () => {
  let sqlite: BetterSqlite3.Database;
  let db: Database;
  let render: RenderService;
  let audit: AuditService;
  let pickService: PickService;
  let weekService: WeekService;
  let standingsService: StandingsService;
  let weekId: number; let seasonYear: number;

  beforeAll(() => {
    sqlite = new BetterSqlite3(':memory:');
    const files = ['0001_create_teams.sql','0002_create_seasons_weeks_games.sql','0003_create_workspaces_players.sql','0004_create_picks_standings.sql','0005_create_audit_log.sql','0006_add_updated_at_columns.sql','0007_add_missing_updated_at_columns.sql'];
    for (const f of files) sqlite.exec(require('fs').readFileSync(require('path').join(__dirname,'../../migrations',f),'utf-8'));
    db = new Database(mockD1(sqlite));
    audit = new AuditService(db);
    pickService = new PickService(db, audit);
    weekService = new WeekService(db, audit, pickService);
    standingsService = new StandingsService(db, audit);
    render = new RenderService();
  });

  beforeEach(async () => {
    // Clean teams to avoid UNIQUE constraint failures if tests rerun
    sqlite.exec("DELETE FROM teams");
    sqlite.exec("INSERT INTO teams (slug,name,conference,division) VALUES ('ravens','Baltimore Ravens','AFC','North'),('chiefs','Kansas City Chiefs','AFC','West')");
    const season = await db.seasons.create({ year: new Date().getFullYear(), weeks_count: 18, state: 'active' });
    seasonYear = season.year;
    const week = await db.weeks.create({ season_id: season.season_id, week_number: 1, state: 'open', open_at: new Date(), close_at: null });
    weekId = week.week_id;
    const ws = await db.workspaces.create({ platform: 'discord', platform_workspace_id: 'W1', name: 'WS', reminder_friday_enabled: 1 as any, reminder_sunday_enabled: 1 as any });
    // Create game before picks to satisfy validation
    const ravensId = (await db.teams.findBySlug('ravens'))!.team_id;
    const chiefsId = (await db.teams.findBySlug('chiefs'))!.team_id;
  const futureKickoff = new Date(Date.now() + 60*60*1000);
  const game = await db.games.create({ week_id: weekId, home_team_id: ravensId, away_team_id: chiefsId, kickoff_time: futureKickoff, status: 'scheduled', home_score: null, away_score: null, winner_team_id: null, external_id: 'G1' });
    const playerA = await db.players.create({ workspace_id: ws.workspace_id, platform_user_id: 'U1', display_name: 'Alice', is_admin: 0 as any, joined_week_id: null });
    const playerB = await db.players.create({ workspace_id: ws.workspace_id, platform_user_id: 'U2', display_name: 'Bob', is_admin: 0 as any, joined_week_id: null });
  await pickService.createPick(playerA.player_id, weekId, ravensId, 'manual');
  await pickService.createPick(playerB.player_id, weekId, chiefsId, 'manual');
  // Advance game to final outcome
  await db.games.update(game.game_id, { status: 'final', home_score: 10, away_score: 27, winner_team_id: chiefsId });
    const picks = await db.picks.findByWeek(weekId);
    // Manually set outcomes
    for (const p of picks) await db.picks.update(p.pick_id, { outcome: p.team_id === chiefsId ? 'loss' : 'win' });
    // Initialize standings
    await standingsService.updateStandings(weekId);
  });

  afterEach(() => { sqlite.exec('PRAGMA foreign_keys=OFF'); ['audit_log','picks','standings','games','weeks','seasons','players','workspaces','teams'].forEach(t => sqlite.exec(`DELETE FROM ${t}`)); sqlite.exec('PRAGMA foreign_keys=ON'); });

  it('generates a non-empty PNG buffer', async () => {
    const standings = await standingsService.getLeaderboard(seasonYear, 1); // workspace id 1 implicitly
    const picksByPlayer: Record<number, any[]> = {};
    for (const s of standings) {
      const playerPicks = await db.picks.findByPlayer(s.player_id);
      picksByPlayer[s.player_id] = playerPicks.map(p => ({ ...p }));
    }
    const buffer = await render.generateWeeklySummaryImage(seasonYear, 1, standings, picksByPlayer as any);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5000); // basic size sanity
  });
});
