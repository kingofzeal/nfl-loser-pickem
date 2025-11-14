/**
 * Database Implementation (Cloudflare D1)
 * 
 * Uses Cloudflare D1 (SQLite-based) serverless database.
 * - Uses .prepare().bind().all()/.first()/.run() for queries
 * - Parameter placeholders are ? instead of $1, $2, etc.
 * - Transactions use D1 batch() API (atomic but limited)
 * - Trigger logic handled in application layer (no database triggers)
 */

import { IDatabase, ITransactionClient } from '../services/interfaces/IDatabase';
import { 
  Team, Season, Week, Game, Workspace, Player, Pick, Standing, AuditLog 
} from '../types';
import { logger } from '../utils/logger';

/**
 * Helper class for collecting statements in a batch transaction
 */
class BatchCollector implements ITransactionClient {
  statements: D1PreparedStatement[] = [];

  async query<T = any>(_text: string, _params?: any[]): Promise<T[]> {
    // Placeholder: In a future implementation, this would collect statements
    throw new Error('BatchCollector.query not yet implemented - use direct batch API instead');
  }
}

export class Database implements IDatabase {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Execute a query with parameters
   * Returns all matching rows
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    try {
      logger.debug('Executing D1 query', { query: text, params });
      
      const stmt = this.db.prepare(text);
      const boundStmt = params && params.length > 0 ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all<T>();
      
      if (!result.success) {
        throw new Error('D1 query failed');
      }
      
      return result.results;
    } catch (error) {
      logger.error('D1 query execution failed', { query: text, params, error });
      throw error;
    }
  }

  /**
   * Execute a callback within a batch (D1's transaction-like mechanism)
   * 
   * Note: D1 batch is not a true transaction with full ACID guarantees.
   * All statements execute atomically, but:
   * - No rollback on business logic errors
   * - Limited to prepared statements collected upfront
   * - Cannot execute conditional logic mid-batch
   * 
   * For complex transactions, consider using service-layer coordination.
   */
  async transaction<T>(callback: (batchCollector: ITransactionClient) => Promise<T>): Promise<T> {
    const collector = new BatchCollector();
    
    try {
      logger.debug('D1 batch transaction started');
      
      // Execute callback to collect statements
      const result = await callback(collector);
      
      // Execute all collected statements as a batch
      if (collector.statements.length > 0) {
        const results = await this.db.batch(collector.statements);
        
        const failed = results.find((r: D1Result) => !r.success);
        if (failed) {
          throw new Error('D1 batch execution failed');
        }
        
        logger.debug('D1 batch transaction completed', { 
          statementCount: collector.statements.length 
        });
      }
      
      return result;
    } catch (error) {
      logger.error('D1 batch transaction failed', { error });
      throw error;
    }
  }

  /**
   * Team operations
   */
  teams = {
    findAll: async (): Promise<Team[]> => {
      return this.query<Team>('SELECT * FROM teams ORDER BY name');
    },

    findById: async (id: number): Promise<Team | null> => {
      const rows = await this.query<Team>(
        'SELECT * FROM teams WHERE team_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findBySlug: async (slug: string): Promise<Team | null> => {
      const rows = await this.query<Team>(
        'SELECT * FROM teams WHERE slug = ?',
        [slug]
      );
      return rows[0] || null;
    },
  };

  /**
   * Season operations
   */
  seasons = {
    findById: async (id: number): Promise<Season | null> => {
      const rows = await this.query<Season>(
        'SELECT * FROM seasons WHERE season_id = ?',
        [id]
      );
      return rows[0] || null;
    },
    findByYear: async (year: number): Promise<Season | null> => {
      const rows = await this.query<Season>(
        'SELECT * FROM seasons WHERE year = ?',
        [year]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Season>): Promise<Season> => {
      const result = await this.db.prepare(
        `INSERT INTO seasons (year, weeks_count, state)
         VALUES (?, ?, ?)`
      ).bind(
        data.year, 
        data.weeks_count || 18, 
        data.state || 'upcoming'
      ).run();

      if (!result.success) {
        throw new Error('Failed to create season');
      }

      // Fetch the created row
      const rows = await this.query<Season>(
        'SELECT * FROM seasons WHERE season_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Season>): Promise<Season> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.state !== undefined) {
        fields.push('state = ?');
        values.push(data.state);
      }
      if (data.weeks_count !== undefined) {
        fields.push('weeks_count = ?');
        values.push(data.weeks_count);
      }

      // Add updated_at timestamp manually (no trigger in D1)
      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE seasons SET ${fields.join(', ')} WHERE season_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update season');
      }

      // Fetch the updated row
      const rows = await this.query<Season>(
        'SELECT * FROM seasons WHERE season_id = ?',
        [id]
      );
      return rows[0];
    },
  };

  /**
   * Week operations
   */
  weeks = {
    findById: async (id: number): Promise<Week | null> => {
      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE week_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findBySeason: async (seasonId: number): Promise<Week[]> => {
      return this.query<Week>(
        'SELECT * FROM weeks WHERE season_id = ? ORDER BY week_number',
        [seasonId]
      );
    },

    findBySeasonAndNumber: async (seasonId: number, weekNumber: number): Promise<Week | null> => {
      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE season_id = ? AND week_number = ?',
        [seasonId, weekNumber]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Week>): Promise<Week> => {
      const openAtVal = data.open_at instanceof Date ? data.open_at.toISOString() : data.open_at;
      const closeAtVal = data.close_at instanceof Date ? data.close_at.toISOString() : data.close_at;
      const result = await this.db.prepare(
        `INSERT INTO weeks (season_id, week_number, state, open_at, close_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        data.season_id, 
        data.week_number, 
        data.state || 'scheduled', 
        openAtVal || null, 
        closeAtVal || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create week');
      }

      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE week_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Week>): Promise<Week> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.state !== undefined) {
        fields.push('state = ?');
        values.push(data.state);
      }
      if (data.open_at !== undefined) {
        fields.push('open_at = ?');
        const openAtVal = data.open_at instanceof Date ? data.open_at.toISOString() : data.open_at;
        values.push(openAtVal);
      }
      if (data.close_at !== undefined) {
        fields.push('close_at = ?');
        const closeAtVal = data.close_at instanceof Date ? data.close_at.toISOString() : data.close_at;
        values.push(closeAtVal);
      }

      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE weeks SET ${fields.join(', ')} WHERE week_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update week');
      }

      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE week_id = ?',
        [id]
      );
      return rows[0];
    },
  };

  /**
   * Game operations
   */
  games = {
    findById: async (id: number): Promise<Game | null> => {
      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE game_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findByWeek: async (weekId: number): Promise<Game[]> => {
      return this.query<Game>(
        'SELECT * FROM games WHERE week_id = ? ORDER BY kickoff_time',
        [weekId]
      );
    },

    findByExternalId: async (externalId: string): Promise<Game | null> => {
      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE external_id = ?',
        [externalId]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Game>): Promise<Game> => {
      const kickoffVal = data.kickoff_time instanceof Date ? data.kickoff_time.toISOString() : data.kickoff_time;
      const result = await this.db.prepare(
        `INSERT INTO games (
          week_id, external_id, home_team_id, away_team_id,
          kickoff_time, status, home_score, away_score, winner_team_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.week_id, data.external_id, data.home_team_id, data.away_team_id,
        kickoffVal, data.status || 'scheduled', 
        data.home_score || null, data.away_score || null, data.winner_team_id || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create game');
      }

      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE game_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Game>): Promise<Game> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.kickoff_time !== undefined) {
        fields.push('kickoff_time = ?');
        values.push(data.kickoff_time);
      }
      if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
      }
      if (data.home_score !== undefined) {
        fields.push('home_score = ?');
        values.push(data.home_score);
      }
      if (data.away_score !== undefined) {
        fields.push('away_score = ?');
        values.push(data.away_score);
      }
      if (data.winner_team_id !== undefined) {
        fields.push('winner_team_id = ?');
        values.push(data.winner_team_id);
      }

      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE games SET ${fields.join(', ')} WHERE game_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update game');
      }

      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE game_id = ?',
        [id]
      );
      return rows[0];
    },

    allFinalForWeek: async (weekId: number): Promise<boolean> => {
      // First check if there are any games; an empty week shouldn't be considered final
      const gameCountRows = await this.query<{ cnt: number }>(
        'SELECT COUNT(1) as cnt FROM games WHERE week_id = ?',
        [weekId]
      );
      if (gameCountRows[0].cnt === 0) {
        return false;
      }
      const rows = await this.query<{ all_final: number }>(
        `SELECT NOT EXISTS(
          SELECT 1 FROM games 
          WHERE week_id = ? AND status != 'final'
         ) as all_final`,
        [weekId]
      );
      return rows[0].all_final === 1;
    },
  };

  /**
   * Workspace operations
   */
  workspaces = {
    findById: async (id: number): Promise<Workspace | null> => {
      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE workspace_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findByPlatformId: async (platform: string, platformWorkspaceId: string): Promise<Workspace | null> => {
      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE platform = ? AND platform_workspace_id = ?',
        [platform, platformWorkspaceId]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Workspace>): Promise<Workspace> => {
      // Coerce boolean flags to INTEGER (1/0) explicitly to avoid driver ambiguity
      const fridayFlag = data.reminder_friday_enabled === undefined
        ? 1
        : (data.reminder_friday_enabled ? 1 : 0);
      const sundayFlag = data.reminder_sunday_enabled === undefined
        ? 1
        : (data.reminder_sunday_enabled ? 1 : 0);

      const result = await this.db.prepare(
        `INSERT INTO workspaces (
          platform, platform_workspace_id, name,
          reminder_friday_enabled, reminder_sunday_enabled
         )
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        data.platform, 
        data.platform_workspace_id, 
        data.name,
        fridayFlag,
        sundayFlag
      ).run();

      if (!result.success) {
        throw new Error('Failed to create workspace');
      }

      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE workspace_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Workspace>): Promise<Workspace> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
      }
      if (data.reminder_friday_enabled !== undefined) {
        fields.push('reminder_friday_enabled = ?');
        values.push(data.reminder_friday_enabled ? 1 : 0);
      }
      if (data.reminder_sunday_enabled !== undefined) {
        fields.push('reminder_sunday_enabled = ?');
        values.push(data.reminder_sunday_enabled ? 1 : 0);
      }

      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE workspaces SET ${fields.join(', ')} WHERE workspace_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update workspace');
      }

      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE workspace_id = ?',
        [id]
      );
      return rows[0];
    },

    findAll: async (): Promise<Workspace[]> => {
      return this.query<Workspace>('SELECT * FROM workspaces');
    },
  };

  /**
   * Player operations
   */
  players = {
    findById: async (id: number): Promise<Player | null> => {
      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE player_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findByWorkspaceAndPlatformUserId: async (workspaceId: number, platformUserId: string): Promise<Player | null> => {
      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE workspace_id = ? AND platform_user_id = ?',
        [workspaceId, platformUserId]
      );
      return rows[0] || null;
    },

    findByWorkspace: async (workspaceId: number): Promise<Player[]> => {
      return this.query<Player>(
        'SELECT * FROM players WHERE workspace_id = ? ORDER BY display_name',
        [workspaceId]
      );
    },

    create: async (data: Partial<Player>): Promise<Player> => {
      const result = await this.db.prepare(
        `INSERT INTO players (
          workspace_id, platform_user_id, display_name, 
          is_admin, joined_week_id
         )
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        data.workspace_id, 
        data.platform_user_id, 
        data.display_name,
        data.is_admin ? 1 : 0,  // SQLite: 1 = true, 0 = false
        data.joined_week_id || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create player');
      }

      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE player_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Player>): Promise<Player> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.display_name !== undefined) {
        fields.push('display_name = ?');
        values.push(data.display_name);
      }
      if (data.is_admin !== undefined) {
        fields.push('is_admin = ?');
        values.push(data.is_admin ? 1 : 0);
      }
      if (data.joined_week_id !== undefined) {
        fields.push('joined_week_id = ?');
        values.push(data.joined_week_id);
      }

      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE players SET ${fields.join(', ')} WHERE player_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update player');
      }

      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE player_id = ?',
        [id]
      );
      return rows[0];
    },
  };

  /**
   * Pick operations
   * 
   * IMPORTANT: Validation logic from PostgreSQL triggers must be handled in PickService:
   * 1. check_no_repeat_teams: Validate player hasn't picked this team in the season
   * 2. check_team_plays_in_week: Validate team has a game in the week
   * 3. update_picks_updated_at: Manually set updated_at on updates
   */
  picks = {
    findById: async (id: number): Promise<Pick | null> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE pick_id = ?',
        [id]
      );
      return rows[0] || null;
    },

    findByWeekAndPlayer: async (weekId: number, playerId: number): Promise<Pick | null> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE week_id = ? AND player_id = ?',
        [weekId, playerId]
      );
      return rows[0] || null;
    },

    findByPlayer: async (playerId: number): Promise<Pick[]> => {
      return this.query<Pick>(
        'SELECT * FROM picks WHERE player_id = ? ORDER BY week_id',
        [playerId]
      );
    },

    findByWeek: async (weekId: number): Promise<Pick[]> => {
      return this.query<Pick>(
        'SELECT * FROM picks WHERE week_id = ?',
        [weekId]
      );
    },

    findBySeason: async (seasonId: number, playerId: number): Promise<Pick[]> => {
      return this.query<Pick>(
        `SELECT p.* FROM picks p
         JOIN weeks w ON p.week_id = w.week_id
         WHERE w.season_id = ? AND p.player_id = ?
         ORDER BY w.week_number`,
        [seasonId, playerId]
      );
    },

    create: async (data: Partial<Pick>): Promise<Pick> => {
      const result = await this.db.prepare(
        `INSERT INTO picks (
          week_id, player_id, team_id, source, locked_at, outcome
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        data.week_id, 
        data.player_id, 
        data.team_id,
        data.source || 'manual', 
        data.locked_at || null, 
        data.outcome || null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create pick');
      }

      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE pick_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Pick>): Promise<Pick> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.team_id !== undefined) {
        fields.push('team_id = ?');
        values.push(data.team_id);
      }
      if (data.locked_at !== undefined) {
        fields.push('locked_at = ?');
        const lockedVal = data.locked_at instanceof Date ? data.locked_at.toISOString() : data.locked_at;
        values.push(lockedVal);
      }
      if (data.outcome !== undefined) {
        fields.push('outcome = ?');
        values.push(data.outcome);
      }

      // Manually set updated_at (no trigger in D1)
      fields.push("updated_at = datetime('now')");
      values.push(id);

      const result = await this.db.prepare(
        `UPDATE picks SET ${fields.join(', ')} WHERE pick_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update pick');
      }

      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE pick_id = ?',
        [id]
      );
      return rows[0];
    },

    delete: async (id: number): Promise<void> => {
      const result = await this.db.prepare(
        'DELETE FROM picks WHERE pick_id = ?'
      ).bind(id).run();

      if (!result.success) {
        throw new Error('Failed to delete pick');
      }
    },
  };

  /**
   * Standing operations
   */
  standings = {
    findBySeasonAndPlayer: async (seasonId: number, playerId: number): Promise<Standing | null> => {
      const rows = await this.query<Standing>(
        'SELECT * FROM standings WHERE season_id = ? AND player_id = ?',
        [seasonId, playerId]
      );
      return rows[0] || null;
    },

    findBySeason: async (seasonId: number): Promise<Standing[]> => {
      return this.query<Standing>(
        `SELECT * FROM standings 
         WHERE season_id = ? 
         ORDER BY wins DESC, losses ASC`,
        [seasonId]
      );
    },

    create: async (data: Partial<Standing>): Promise<Standing> => {
      const result = await this.db.prepare(
        `INSERT INTO standings (season_id, player_id, wins, losses)
         VALUES (?, ?, ?, ?)`
      ).bind(
        data.season_id, 
        data.player_id, 
        data.wins || 0, 
        data.losses || 0
      ).run();

      if (!result.success) {
        throw new Error('Failed to create standing');
      }

      const rows = await this.query<Standing>(
        'SELECT * FROM standings WHERE standing_id = ?',
        [result.meta.last_row_id]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Standing>): Promise<Standing> => {
      const fields: string[] = [];
      const values: any[] = [];

      if (data.wins !== undefined) {
        fields.push('wins = ?');
        values.push(data.wins);
      }
      if (data.losses !== undefined) {
        fields.push('losses = ?');
        values.push(data.losses);
      }

      values.push(id);

      const result = await this.db.prepare(
        `UPDATE standings SET ${fields.join(', ')} WHERE standing_id = ?`
      ).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update standing');
      }

      const rows = await this.query<Standing>(
        'SELECT * FROM standings WHERE standing_id = ?',
        [id]
      );
      return rows[0];
    },
  };

  /**
   * Audit log operations
   * 
   * Note: payload is stored as TEXT in D1 (was JSONB in PostgreSQL)
   * Use JSON.stringify() when creating, JSON.parse() when reading
   */
  auditLog = {
    create: async (data: Partial<AuditLog>): Promise<AuditLog> => {
      const result = await this.db.prepare(
        `INSERT INTO audit_log (
          workspace_id, actor_type, actor_id, action, 
          entity_type, entity_id, payload
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.workspace_id, 
        data.actor_type, 
        data.actor_id || null, 
        data.action,
        data.entity_type || null, 
        data.entity_id || null,
        data.payload ? JSON.stringify(data.payload) : null
      ).run();

      if (!result.success) {
        throw new Error('Failed to create audit log');
      }

      const rows = await this.query<AuditLog>(
        'SELECT * FROM audit_log WHERE log_id = ?',
        [result.meta.last_row_id]
      );
      
      // Parse payload back to object
      const row = rows[0];
      if (row && row.payload && typeof row.payload === 'string') {
        row.payload = JSON.parse(row.payload);
      }
      
      return row;
    },

    findByWorkspace: async (workspaceId: number, limit: number = 100): Promise<AuditLog[]> => {
      const rows = await this.query<AuditLog>(
        `SELECT * FROM audit_log 
         WHERE workspace_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [workspaceId, limit]
      );
      
      // Parse payload for each row
      return rows.map(row => {
        if (row.payload && typeof row.payload === 'string') {
          row.payload = JSON.parse(row.payload);
        }
        return row;
      });
    },
  };
}
