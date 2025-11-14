/**
 * StandingsService Edge Cases
 */
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../src/database/Database';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';
import { StandingsService } from '../../src/services/StandingsService';

function mockD1(sqlite: BetterSqlite3.Database): D1Database { return { prepare: (q: string) => { const s = sqlite.prepare(q); return { bind: (...v:any[])=>({ all: async()=>({success:true,results:s.all(...v)}), first: async()=>s.get(...v)||null, run: async()=>{const i=s.run(...v);return{success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} }), all: async()=>({success:true,results:s.all()}), first: async()=>s.get()||null, run: async()=>{const i=s.run();return{success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} } as any; }, batch: async (stmts:any[])=>Promise.all(stmts.map(st=>st.run())), dump: async()=>new ArrayBuffer(0), exec: async()=>({count:0,duration:0}) } as any; }

describe('Standings edge cases', () => {
  let sqlite: BetterSqlite3.Database; let db: Database; let audit: AuditService; let pickService: PickService; let weekService: WeekService; let standings: StandingsService; let weekId: number; let seasonId: number; let playerTie: number; let playerMissing: number;
  beforeAll(()=>{ sqlite=new BetterSqlite3(':memory:'); const files=['0001_create_teams.sql','0002_create_seasons_weeks_games.sql','0003_create_workspaces_players.sql','0004_create_picks_standings.sql','0005_create_audit_log.sql','0006_add_updated_at_columns.sql','0007_add_missing_updated_at_columns.sql']; for(const f of files) sqlite.exec(require('fs').readFileSync(require('path').join(__dirname,'../../migrations',f),'utf-8')); db=new Database(mockD1(sqlite)); audit=new AuditService(db); pickService=new PickService(db,audit); weekService=new WeekService(db,audit,pickService); standings=new StandingsService(db,audit); });
  beforeEach(async()=>{
    // Clean teams to avoid UNIQUE constraint failures between tests
    sqlite.exec("DELETE FROM teams");
    sqlite.exec("INSERT INTO teams (slug,name,conference,division) VALUES ('ravens','Baltimore Ravens','AFC','North'),('chiefs','Kansas City Chiefs','AFC','West'),('bills','Buffalo Bills','AFC','East')");
    const season = await db.seasons.create({ year: new Date().getFullYear(), weeks_count: 18, state: 'active' }); seasonId=season.season_id;
    const week = await db.weeks.create({ season_id: season.season_id, week_number: 1, state: 'open', open_at: new Date(), close_at: null }); weekId=week.week_id;
    const ws = await db.workspaces.create({ platform:'discord', platform_workspace_id:'W1', name:'WS', reminder_friday_enabled:1 as any, reminder_sunday_enabled:1 as any });
    playerTie = (await db.players.create({ workspace_id: ws.workspace_id, platform_user_id:'U1', display_name:'TiePlayer', is_admin:0 as any, joined_week_id:null })).player_id;
    playerMissing = (await db.players.create({ workspace_id: ws.workspace_id, platform_user_id:'U2', display_name:'MissingPlayer', is_admin:0 as any, joined_week_id:null })).player_id;
    // Game that will tie (winner_team_id null final) must exist before pick for validation
  const ravensId=(await db.teams.findBySlug('ravens'))!.team_id; const chiefsId=(await db.teams.findBySlug('chiefs'))!.team_id;
  const futureKickoff = new Date(Date.now() + 60*60*1000); // 1h in future so pick validation passes
  const tieGame = await db.games.create({ week_id: weekId, home_team_id: ravensId, away_team_id: chiefsId, kickoff_time: futureKickoff, status:'scheduled', home_score: null, away_score: null, winner_team_id: null, external_id:'GTIE' });
  // Tie player picks ravens (now valid - game not started)
  await pickService.createPick(playerTie, weekId, ravensId, 'manual');
  // Advance game to final tie state
  await db.games.update(tieGame.game_id, { status: 'final', home_score: 10, away_score: 10, winner_team_id: null });
  // Add a second completed game with a winner to allow auto-assignment logic
  const billsId=(await db.teams.findBySlug('bills'))!.team_id;
  await db.games.create({ week_id: weekId, home_team_id: billsId, away_team_id: chiefsId, kickoff_time: futureKickoff, status: 'final', home_score: 14, away_score: 21, winner_team_id: chiefsId, external_id: 'GWIN' });
  });
  afterEach(()=>{ sqlite.exec('PRAGMA foreign_keys=OFF'); ['audit_log','picks','standings','games','weeks','seasons','players','workspaces','teams'].forEach(t=>sqlite.exec(`DELETE FROM ${t}`)); sqlite.exec('PRAGMA foreign_keys=ON'); });
  it('counts tie as loss and auto-assigns for missing player', async () => {
    // Finalize week triggers processMissingPicks + outcomes
    const finalized = await weekService.finalizeWeek(weekId);
    expect(finalized.state).toBe('finalized');
    const tiePick = await db.picks.findByWeekAndPlayer(weekId, playerTie);
    expect(tiePick?.outcome).toBe('loss'); // tie treated as loss
    const missingPlayersPicks = await db.picks.findByWeekAndPlayer(weekId, playerMissing);
    expect(missingPlayersPicks).toBeTruthy();
    expect(missingPlayersPicks?.source).toBe('auto_assigned');
  });
  it('ignores cancelled game for outcome updates', async () => {
    // New week with cancelled game pick
    const week2 = await db.weeks.create({ season_id: seasonId, week_number: 2, state: 'open', open_at: new Date(), close_at: null });
    const ravensId=(await db.teams.findBySlug('ravens'))!.team_id; const billsId=(await db.teams.findBySlug('bills'))!.team_id;
    // Use a different player so team reuse validation doesn't trigger
    const playerCancel = (await db.players.create({ workspace_id: (await db.players.findById(playerTie))!.workspace_id, platform_user_id:'U3', display_name:'CancelPlayer', is_admin:0 as any, joined_week_id:null })).player_id;
    // Game first (cancelled), then pick so validation passes
  const futureKickoff2 = new Date(Date.now() + 60*60*1000);
  const canGame = await db.games.create({ week_id: week2.week_id, home_team_id: ravensId, away_team_id: billsId, kickoff_time: futureKickoff2, status:'scheduled', home_score:null, away_score:null, winner_team_id:null, external_id:'GCAN' });
  await pickService.createPick(playerCancel, week2.week_id, ravensId, 'manual');
  // Mark game cancelled after pick locked
  await db.games.update(canGame.game_id, { status: 'cancelled' });
    const fin = await weekService.finalizeWeek(week2.week_id);
    expect(fin.state).toBe('finalized');
    const pick = await db.picks.findByWeekAndPlayer(week2.week_id, playerCancel);
    expect(pick?.outcome).toBeNull(); // no outcome for cancelled
  });
});
