/**
 * Data Ingestion Integration Test
 * Verifies GameService.syncGames upserts and audit logging across status transitions.
 */
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../src/database/Database';
import { AuditService } from '../../src/services/AuditService';
import { GameService } from '../../src/services/GameService';
import { WeekService } from '../../src/services/WeekService';
import { PickService } from '../../src/services/PickService';

// Minimal IDataProvider stub
class StubProvider {
  name = 'stub';
  constructor(private sequences: any[][]) {}
  callIndex = 0;
  mapTeamToSlug(team: string) { return team.toLowerCase(); }
  async fetchGamesForWeek(weekNumber: number, seasonYear: number) {
    return this.sequences[this.callIndex++];
  }
}

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

describe('Data Ingestion - GameService.syncGames', () => {
  let sqlite: BetterSqlite3.Database;
  let db: Database;
  let audit: AuditService;
  let pickService: PickService;
  let weekService: WeekService;
  let gameService: GameService;
  let weekId: number;

  beforeAll(() => {
    sqlite = new BetterSqlite3(':memory:');
    const migrationFiles = ['0001_create_teams.sql','0002_create_seasons_weeks_games.sql','0003_create_workspaces_players.sql','0004_create_picks_standings.sql','0005_create_audit_log.sql','0006_add_updated_at_columns.sql','0007_add_missing_updated_at_columns.sql'];
    for (const f of migrationFiles) {
      sqlite.exec(require('fs').readFileSync(require('path').join(__dirname,'../../migrations',f),'utf-8'));
    }
    db = new Database(mockD1(sqlite));
    audit = new AuditService(db);
    pickService = new PickService(db, audit);
    weekService = new WeekService(db, audit, pickService);
  });

  beforeEach(async () => {
    // Ensure clean team slate then seed subset teams (avoid UNIQUE constraint if beforeEach runs multiple times)
    sqlite.exec("DELETE FROM teams");
    sqlite.exec("INSERT INTO teams (slug,name,conference,division) VALUES ('ravens','Baltimore Ravens','AFC','North'),('chiefs','Kansas City Chiefs','AFC','West')");
    const season = await db.seasons.create({ year: new Date().getFullYear(), weeks_count: 18, state: 'active' });
    const week = await db.weeks.create({ season_id: season.season_id, week_number: 1, state: 'scheduled', open_at: new Date(), close_at: null });
    weekId = week.week_id;
    await db.workspaces.create({ platform: 'discord', platform_workspace_id: 'W1', name: 'WS', reminder_friday_enabled: 1 as any, reminder_sunday_enabled: 1 as any });
  });

  afterEach(() => {
    ['audit_log','picks','standings','games','weeks','seasons','players','workspaces','teams'].forEach(t => sqlite.exec(`DELETE FROM ${t}`));
  });

  it('upserts and updates game statuses with audit logging', async () => {
    const sequences = [
      [ // initial scheduled
        { externalId: 'GEXT1', homeTeamSlug: 'ravens', awayTeamSlug: 'chiefs', kickoffTime: new Date().toISOString(), status: 'scheduled', homeScore: null, awayScore: null },
      ],
      [ // in progress
        { externalId: 'GEXT1', homeTeamSlug: 'ravens', awayTeamSlug: 'chiefs', kickoffTime: new Date().toISOString(), status: 'in_progress', homeScore: 7, awayScore: 10 },
      ],
      [ // final
        { externalId: 'GEXT1', homeTeamSlug: 'ravens', awayTeamSlug: 'chiefs', kickoffTime: new Date().toISOString(), status: 'final', homeScore: 10, awayScore: 27 },
      ],
    ];
    gameService = new GameService(db, audit, new StubProvider(sequences));

    // Open week so sync permissible
    await weekService.openWeek(weekId);
    await gameService.syncGames(weekId); // create
    let game = await db.games.findByExternalId('GEXT1');
    expect(game).toBeTruthy();
    expect(game?.status).toBe('scheduled');

    await gameService.syncGames(weekId); // update to in_progress
    game = await db.games.findByExternalId('GEXT1');
    expect(game?.status).toBe('in_progress');

    await gameService.syncGames(weekId); // update to final
    game = await db.games.findByExternalId('GEXT1');
    expect(game?.status).toBe('final');
    expect(game?.winner_team_id).not.toBeNull();

    const logs = await db.auditLog.findByWorkspace(1, 50); // workspace_id 1
    const actions = logs.map(l => l.action);
    expect(actions.filter(a => a === 'games_synced').length).toBe(3);
  });
});
