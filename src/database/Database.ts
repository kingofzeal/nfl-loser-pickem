import { PoolClient } from 'pg';
import { IDatabase } from '../services/interfaces/IDatabase';
import { 
  Team, Season, Week, Game, Workspace, Player, Pick, Standing, AuditLog 
} from '../types';
import { getPool, query } from './connection';
import { logger } from '../utils/logger';

export class Database implements IDatabase {
  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    return query<T>(text, params);
  }

  /**
   * Execute a callback within a transaction
   * Automatically commits on success or rolls back on error
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    
    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Team operations
   */
  teams = {
    findAll: async (): Promise<Team[]> => {
      const rows = await this.query<Team>(
        'SELECT * FROM teams ORDER BY name'
      );
      return rows;
    },

    findById: async (id: number): Promise<Team | null> => {
      const rows = await this.query<Team>(
        'SELECT * FROM teams WHERE team_id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findBySlug: async (slug: string): Promise<Team | null> => {
      const rows = await this.query<Team>(
        'SELECT * FROM teams WHERE slug = $1',
        [slug]
      );
      return rows[0] || null;
    },
  };

  /**
   * Season operations
   */
  seasons = {
    findByYear: async (year: number): Promise<Season | null> => {
      const rows = await this.query<Season>(
        'SELECT * FROM seasons WHERE year = $1',
        [year]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Season>): Promise<Season> => {
      const rows = await this.query<Season>(
        `INSERT INTO seasons (year, weeks_count, state)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.year, data.weeks_count || 18, data.state || 'upcoming']
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Season>): Promise<Season> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.state !== undefined) {
        fields.push(`state = $${paramCount++}`);
        values.push(data.state);
      }
      if (data.weeks_count !== undefined) {
        fields.push(`weeks_count = $${paramCount++}`);
        values.push(data.weeks_count);
      }

      values.push(id);

      const rows = await this.query<Season>(
        `UPDATE seasons SET ${fields.join(', ')}
         WHERE season_id = $${paramCount}
         RETURNING *`,
        values
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
        'SELECT * FROM weeks WHERE week_id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findBySeason: async (seasonId: number): Promise<Week[]> => {
      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE season_id = $1 ORDER BY week_number',
        [seasonId]
      );
      return rows;
    },

    findBySeasonAndNumber: async (seasonId: number, weekNumber: number): Promise<Week | null> => {
      const rows = await this.query<Week>(
        'SELECT * FROM weeks WHERE season_id = $1 AND week_number = $2',
        [seasonId, weekNumber]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Week>): Promise<Week> => {
      const rows = await this.query<Week>(
        `INSERT INTO weeks (season_id, week_number, state, open_at, close_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.season_id, data.week_number, data.state || 'scheduled', data.open_at || null, data.close_at || null]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Week>): Promise<Week> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.state !== undefined) {
        fields.push(`state = $${paramCount++}`);
        values.push(data.state);
      }
      if (data.open_at !== undefined) {
        fields.push(`open_at = $${paramCount++}`);
        values.push(data.open_at);
      }
      if (data.close_at !== undefined) {
        fields.push(`close_at = $${paramCount++}`);
        values.push(data.close_at);
      }

      values.push(id);

      const rows = await this.query<Week>(
        `UPDATE weeks SET ${fields.join(', ')}
         WHERE week_id = $${paramCount}
         RETURNING *`,
        values
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
        'SELECT * FROM games WHERE game_id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findByWeek: async (weekId: number): Promise<Game[]> => {
      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE week_id = $1 ORDER BY kickoff_time',
        [weekId]
      );
      return rows;
    },

    findByExternalId: async (externalId: string): Promise<Game | null> => {
      const rows = await this.query<Game>(
        'SELECT * FROM games WHERE external_id = $1',
        [externalId]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Game>): Promise<Game> => {
      const rows = await this.query<Game>(
        `INSERT INTO games (
          week_id, external_id, home_team_id, away_team_id,
          kickoff_time, status, home_score, away_score, winner_team_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.week_id, data.external_id, data.home_team_id, data.away_team_id,
          data.kickoff_time, data.status || 'scheduled', 
          data.home_score || null, data.away_score || null, data.winner_team_id || null
        ]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Game>): Promise<Game> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.kickoff_time !== undefined) {
        fields.push(`kickoff_time = $${paramCount++}`);
        values.push(data.kickoff_time);
      }
      if (data.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.home_score !== undefined) {
        fields.push(`home_score = $${paramCount++}`);
        values.push(data.home_score);
      }
      if (data.away_score !== undefined) {
        fields.push(`away_score = $${paramCount++}`);
        values.push(data.away_score);
      }
      if (data.winner_team_id !== undefined) {
        fields.push(`winner_team_id = $${paramCount++}`);
        values.push(data.winner_team_id);
      }

      values.push(id);

      const rows = await this.query<Game>(
        `UPDATE games SET ${fields.join(', ')}
         WHERE game_id = $${paramCount}
         RETURNING *`,
        values
      );
      return rows[0];
    },

    allFinalForWeek: async (weekId: number): Promise<boolean> => {
      const rows = await this.query<{ all_final: boolean }>(
        `SELECT NOT EXISTS(
          SELECT 1 FROM games 
          WHERE week_id = $1 AND status != 'final'
         ) as all_final`,
        [weekId]
      );
      return rows[0].all_final;
    },
  };

  /**
   * Workspace operations
   */
  workspaces = {
    findById: async (id: number): Promise<Workspace | null> => {
      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE workspace_id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findByPlatformId: async (platform: string, platformWorkspaceId: string): Promise<Workspace | null> => {
      const rows = await this.query<Workspace>(
        'SELECT * FROM workspaces WHERE platform = $1 AND platform_workspace_id = $2',
        [platform, platformWorkspaceId]
      );
      return rows[0] || null;
    },

    create: async (data: Partial<Workspace>): Promise<Workspace> => {
      const rows = await this.query<Workspace>(
        `INSERT INTO workspaces (
          platform, platform_workspace_id, name,
          reminder_friday_enabled, reminder_sunday_enabled
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.platform, data.platform_workspace_id, data.name,
          data.reminder_friday_enabled ?? true, data.reminder_sunday_enabled ?? true
        ]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Workspace>): Promise<Workspace> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.reminder_friday_enabled !== undefined) {
        fields.push(`reminder_friday_enabled = $${paramCount++}`);
        values.push(data.reminder_friday_enabled);
      }
      if (data.reminder_sunday_enabled !== undefined) {
        fields.push(`reminder_sunday_enabled = $${paramCount++}`);
        values.push(data.reminder_sunday_enabled);
      }

      values.push(id);

      const rows = await this.query<Workspace>(
        `UPDATE workspaces SET ${fields.join(', ')}
         WHERE workspace_id = $${paramCount}
         RETURNING *`,
        values
      );
      return rows[0];
    },
  };

  /**
   * Player operations
   */
  players = {
    findById: async (id: number): Promise<Player | null> => {
      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE player_id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findByWorkspaceAndPlatformUserId: async (workspaceId: number, platformUserId: string): Promise<Player | null> => {
      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE workspace_id = $1 AND platform_user_id = $2',
        [workspaceId, platformUserId]
      );
      return rows[0] || null;
    },

    findByWorkspace: async (workspaceId: number): Promise<Player[]> => {
      const rows = await this.query<Player>(
        'SELECT * FROM players WHERE workspace_id = $1 ORDER BY display_name',
        [workspaceId]
      );
      return rows;
    },

    create: async (data: Partial<Player>): Promise<Player> => {
      const rows = await this.query<Player>(
        `INSERT INTO players (
          workspace_id, platform_user_id, display_name, 
          is_admin, joined_week_id
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.workspace_id, data.platform_user_id, data.display_name,
          data.is_admin ?? false, data.joined_week_id || null
        ]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Player>): Promise<Player> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.display_name !== undefined) {
        fields.push(`display_name = $${paramCount++}`);
        values.push(data.display_name);
      }
      if (data.is_admin !== undefined) {
        fields.push(`is_admin = $${paramCount++}`);
        values.push(data.is_admin);
      }
      if (data.joined_week_id !== undefined) {
        fields.push(`joined_week_id = $${paramCount++}`);
        values.push(data.joined_week_id);
      }

      values.push(id);

      const rows = await this.query<Player>(
        `UPDATE players SET ${fields.join(', ')}
         WHERE player_id = $${paramCount}
         RETURNING *`,
        values
      );
      return rows[0];
    },
  };

  /**
   * Pick operations
   */
  picks = {
    findById: async (id: number): Promise<Pick | null> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE id = $1',
        [id]
      );
      return rows[0] || null;
    },

    findByWeekAndPlayer: async (weekId: number, playerId: number): Promise<Pick | null> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE week_id = $1 AND player_id = $2',
        [weekId, playerId]
      );
      return rows[0] || null;
    },

    findByPlayer: async (playerId: number): Promise<Pick[]> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE player_id = $1 ORDER BY week_id',
        [playerId]
      );
      return rows;
    },

    findByWeek: async (weekId: number): Promise<Pick[]> => {
      const rows = await this.query<Pick>(
        'SELECT * FROM picks WHERE week_id = $1',
        [weekId]
      );
      return rows;
    },

    findBySeason: async (seasonId: number, playerId: number): Promise<Pick[]> => {
      const rows = await this.query<Pick>(
        `SELECT p.* FROM picks p
         JOIN weeks w ON p.week_id = w.id
         WHERE w.season_id = $1 AND p.player_id = $2
         ORDER BY w.week_number`,
        [seasonId, playerId]
      );
      return rows;
    },

    create: async (data: Partial<Pick>): Promise<Pick> => {
      const rows = await this.query<Pick>(
        `INSERT INTO picks (
          week_id, player_id, team_id, source, locked_at, outcome
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.week_id, data.player_id, data.team_id,
          data.source || 'manual', data.locked_at || null, data.outcome || null
        ]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Pick>): Promise<Pick> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.team_id !== undefined) {
        fields.push(`team_id = $${paramCount++}`);
        values.push(data.team_id);
      }
      if (data.locked_at !== undefined) {
        fields.push(`locked_at = $${paramCount++}`);
        values.push(data.locked_at);
      }
      if (data.outcome !== undefined) {
        fields.push(`outcome = $${paramCount++}`);
        values.push(data.outcome);
      }

      values.push(id);

      const rows = await this.query<Pick>(
        `UPDATE picks SET ${fields.join(', ')}
         WHERE pick_id = $${paramCount}
         RETURNING *`,
        values
      );
      return rows[0];
    },

    delete: async (id: number): Promise<void> => {
      await this.query('DELETE FROM picks WHERE pick_id = $1', [id]);
    },
  };

  /**
   * Standing operations
   */
  standings = {
    findBySeasonAndPlayer: async (seasonId: number, playerId: number): Promise<Standing | null> => {
      const rows = await this.query<Standing>(
        'SELECT * FROM standings WHERE season_id = $1 AND player_id = $2',
        [seasonId, playerId]
      );
      return rows[0] || null;
    },

    findBySeason: async (seasonId: number): Promise<Standing[]> => {
      const rows = await this.query<Standing>(
        `SELECT * FROM standings 
         WHERE season_id = $1 
         ORDER BY wins DESC, losses ASC`,
        [seasonId]
      );
      return rows;
    },

    create: async (data: Partial<Standing>): Promise<Standing> => {
      const rows = await this.query<Standing>(
        `INSERT INTO standings (season_id, player_id, wins, losses)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.season_id, data.player_id, data.wins || 0, data.losses || 0]
      );
      return rows[0];
    },

    update: async (id: number, data: Partial<Standing>): Promise<Standing> => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.wins !== undefined) {
        fields.push(`wins = $${paramCount++}`);
        values.push(data.wins);
      }
      if (data.losses !== undefined) {
        fields.push(`losses = $${paramCount++}`);
        values.push(data.losses);
      }

      values.push(id);

      const rows = await this.query<Standing>(
        `UPDATE standings SET ${fields.join(', ')}
         WHERE standing_id = $${paramCount}
         RETURNING *`,
        values
      );
      return rows[0];
    },
  };

  /**
   * Audit log operations
   */
  auditLog = {
    create: async (data: Partial<AuditLog>): Promise<AuditLog> => {
      const rows = await this.query<AuditLog>(
        `INSERT INTO audit_log (
          workspace_id, actor_type, actor_id, action, 
          entity_type, entity_id, payload
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.workspace_id, data.actor_type, data.actor_id || null, data.action,
          data.entity_type || null, data.entity_id || null,
          data.payload || null
        ]
      );
      return rows[0];
    },

    findByWorkspace: async (workspaceId: number, limit: number = 100): Promise<AuditLog[]> => {
      const rows = await this.query<AuditLog>(
        `SELECT * FROM audit_log 
         WHERE workspace_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [workspaceId, limit]
      );
      return rows;
    },
  };
}
