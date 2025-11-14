/**
 * Season Rollover Test
 */
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../src/database/Database';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';

function mockD1(sqlite: BetterSqlite3.Database): D1Database { return { prepare: (q: string)=>{ const s=sqlite.prepare(q); return { bind:(...v:any[])=>({ all: async()=>({success:true,results:s.all(...v)}), first: async()=>s.get(...v)||null, run: async()=>{ const i=s.run(...v); return {success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} }), all: async()=>({success:true,results:s.all()}), first: async()=>s.get()||null, run: async()=>{ const i=s.run(); return {success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} } as any; }, batch: async(stmts:any[])=>Promise.all(stmts.map(st=>st.run())) } as any; }

describe('Season rollover', () => {
  let sqlite: BetterSqlite3.Database; let db: Database; let weekService: WeekService; let pickService: PickService; let audit: AuditService; let seasonId: number;
  beforeAll(()=>{ sqlite=new BetterSqlite3(':memory:'); const files=['0001_create_teams.sql','0002_create_seasons_weeks_games.sql','0003_create_workspaces_players.sql','0004_create_picks_standings.sql','0005_create_audit_log.sql','0006_add_updated_at_columns.sql','0007_add_missing_updated_at_columns.sql']; for(const f of files) sqlite.exec(require('fs').readFileSync(require('path').join(__dirname,'../../migrations',f),'utf-8')); db=new Database(mockD1(sqlite)); audit=new AuditService(db); pickService=new PickService(db,audit); weekService=new WeekService(db,audit,pickService); });
  beforeEach(async()=>{ // Teams already inserted by migration 0001; avoid duplicate slug insert
    const season=await db.seasons.create({ year: new Date().getFullYear(), weeks_count: 2, state: 'active' });
    seasonId=season.season_id;
    for(let w=1; w<=2; w++){
      await db.weeks.create({ season_id: seasonId, week_number: w, state: 'open', open_at: new Date(), close_at: null });
    }
    await db.workspaces.create({ platform:'discord', platform_workspace_id:'W1', name:'WS', reminder_friday_enabled:1 as any, reminder_sunday_enabled:1 as any });
  });
  afterEach(()=>['audit_log','picks','standings','games','weeks','seasons','players','workspaces','teams'].forEach(t=>sqlite.exec(`DELETE FROM ${t}`)));
  it('marks season completed and initializes next season', async () => {
    // For each week create a final game and finalize
    const weeks = await db.weeks.findBySeason(seasonId);
    const ravensId=(await db.teams.findBySlug('ravens'))!.team_id; const chiefsId=(await db.teams.findBySlug('chiefs'))!.team_id;
    for (const w of weeks) {
  await db.games.create({ week_id: w.week_id, home_team_id: ravensId, away_team_id: chiefsId, kickoff_time: new Date(), status:'final', home_score:10, away_score:27, winner_team_id: chiefsId, external_id:`G${w.week_number}` });
      await weekService.finalizeWeek(w.week_id);
    }
    const seasonRows = await db.seasons.findByYear(new Date().getFullYear());
    expect(seasonRows?.state).toBe('completed');
    const nextSeason = await db.seasons.findByYear(new Date().getFullYear()+1);
    expect(nextSeason).toBeTruthy();
    expect(nextSeason?.state).toBe('upcoming');
    const logs = await db.auditLog.findByWorkspace(1, 100);
    const actions = logs.map(l=>l.action);
    expect(actions).toEqual(expect.arrayContaining(['season_completed','season_initialized']));
  });
});
