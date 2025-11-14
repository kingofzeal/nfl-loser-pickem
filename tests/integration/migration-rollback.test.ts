/**
 * Migration Rollback Detection Test
 * Simulates missing updated_at columns then applying migration 0006 to fix.
 */
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../../src/database/Database';
import { AuditService } from '../../src/services/AuditService';
import { PickService } from '../../src/services/PickService';
import { WeekService } from '../../src/services/WeekService';

function mockD1(sqlite: BetterSqlite3.Database): D1Database { return { prepare: (q:string)=>{ const s=sqlite.prepare(q); return { bind:(...v:any[])=>({ all: async()=>({success:true,results:s.all(...v)}), first: async()=>s.get(...v)||null, run: async()=>{ const i=s.run(...v); return {success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} }), all: async()=>({success:true,results:s.all()}), first: async()=>s.get()||null, run: async()=>{ const i=s.run(); return {success:true,meta:{last_row_id:i.lastInsertRowid,changes:i.changes}};} } as any; }, batch: async(stmts:any[])=>Promise.all(stmts.map(st=>st.run())) } as any; }

describe('Migration rollback detection', () => {
  it('opens weeks successfully with embedded updated_at columns; legacy migration is harmless', async () => {
    // Setup DB with base migrations (these already include updated_at columns now)
    const sqlite = new BetterSqlite3(':memory:');
    const baseFiles = [
      '0001_create_teams.sql',
      '0002_create_seasons_weeks_games.sql',
      '0003_create_workspaces_players.sql',
      '0004_create_picks_standings.sql',
      '0005_create_audit_log.sql'
    ];
    for (const f of baseFiles) {
      sqlite.exec(require('fs').readFileSync(require('path').join(__dirname, '../../migrations', f), 'utf-8'));
    }

    const db = new Database(mockD1(sqlite));
    const audit = new AuditService(db);
    const pick = new PickService(db, audit);
    const weekSvc = new WeekService(db, audit, pick);

    // Create active season and scheduled week
    const season = await db.seasons.create({ year: 2025, weeks_count: 2, state: 'active' });
    const week1 = await db.weeks.create({ season_id: season.season_id, week_number: 1, state: 'scheduled', open_at: new Date(Date.now() - 1000), close_at: null });

    const openedWeek1 = await weekSvc.openWeek(week1.week_id);
    expect(openedWeek1.state).toBe('open');

    // Apply legacy migration (now a no-op) - should not break existing data
    const legacyPath = require('path').join(__dirname, '../../migrations', '0006_add_updated_at_columns.sql');
    const legacySql = require('fs').readFileSync(legacyPath, 'utf-8');
    if (legacySql.trim().length > 0) {
      sqlite.exec(legacySql); // If file still has statements, ensure they run without error
    }

    // Create and open a second week to verify continued functionality
    const week2 = await db.weeks.create({ season_id: season.season_id, week_number: 2, state: 'scheduled', open_at: new Date(Date.now() - 1000), close_at: null });
    const openedWeek2 = await weekSvc.openWeek(week2.week_id);
    expect(openedWeek2.state).toBe('open');
  });
});
