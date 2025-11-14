/**
 * WeekService Implementation
 * 
 * Handles week lifecycle management:
 * - Opening weeks for picks
 * - Closing games at kickoff
 * - Finalizing weeks after all games complete
 * - Processing missing picks
 */

import { IWeekService } from './interfaces/IWeekService';
import { IDatabase } from './interfaces/IDatabase';
import { IAuditService } from './interfaces/IAuditService';
import { IPickService } from './interfaces/IPickService';
import { Week } from '../types';
import { logger } from '../utils/logger';

export class WeekService implements IWeekService {
  constructor(
    private db: IDatabase,
    private auditService: IAuditService,
    private pickService: IPickService
  ) {}

  /**
   * Open a week for picks
   * Can be done manually by admin or scheduled by cron
   */
  async openWeek(weekId: number, actorId?: number): Promise<Week> {
    try {
      logger.debug('Opening week', { weekId, actorId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      if (week.state !== 'scheduled') {
        throw new Error(`Week is in ${week.state} state and cannot be opened`);
      }

      // Update week state to open
      const updatedWeek = await this.db.weeks.update(weekId, {
        state: 'open',
        open_at: new Date(),
      });

      // Get workspace IDs that are using this season
      const workspaces = await this.db.workspaces.findAll();
      
      // Audit log for each workspace
      for (const workspace of workspaces) {
        await this.auditService.log({
          workspace_id: workspace.workspace_id,
          actor_type: actorId ? 'admin' : 'system',
          actor_id: actorId,
          action: 'week_opened',
          entity_type: 'week',
          entity_id: weekId,
          payload: { week_number: week.week_number, season_id: week.season_id },
        });
      }

      logger.info('Week opened', { 
        week_id: weekId,
        week_number: week.week_number,
        actor_id: actorId,
      });

      return updatedWeek;
    } catch (error) {
      logger.error('Failed to open week', { error, weekId });
      throw new Error(`Failed to open week: ${error}`);
    }
  }

  /**
   * Close individual games at kickoff
   * Locks picks for teams playing in those games
   */
  async closeGames(weekId: number): Promise<void> {
    try {
      logger.debug('Closing games for week', { weekId });

      const games = await this.db.games.findByWeek(weekId);
      const now = new Date();

      let closedCount = 0;

      for (const game of games) {
        const kickoffTime = new Date(game.kickoff_time);
        
        // If game has kicked off and is still in scheduled state
        if (kickoffTime <= now && game.status === 'scheduled') {
          // Update game status
          await this.db.games.update(game.game_id, {
            status: 'in_progress',
          });

          // Lock picks for teams in this game
          const picks = await this.pickService.getPicksForWeek(weekId);
          const relevantPicks = picks.filter(p => 
            p.team_id === game.home_team_id || p.team_id === game.away_team_id
          );

          for (const pick of relevantPicks) {
            if (!pick.locked_at) {
              await this.pickService.lockPick(pick.pick_id);
            }
          }

          closedCount++;
          logger.debug('Game closed', { 
            game_id: game.game_id,
            picks_locked: relevantPicks.length,
          });
        }
      }

      // Update week state if any games started
      if (closedCount > 0) {
        const week = await this.db.weeks.findById(weekId);
        if (week && week.state === 'open') {
          await this.db.weeks.update(weekId, {
            state: 'in_progress',
          });
        }
      }

      logger.info('Games closed for week', { 
        week_id: weekId,
        games_closed: closedCount,
      });
    } catch (error) {
      logger.error('Failed to close games', { error, weekId });
      throw new Error(`Failed to close games: ${error}`);
    }
  }

  /**
   * Finalize a week after all games are complete
   * Processes missing picks and updates outcomes
   */
  async finalizeWeek(weekId: number, actorId?: number): Promise<Week> {
    try {
      logger.debug('Finalizing week', { weekId, actorId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      if (week.state === 'finalized') {
        logger.debug('Week already finalized', { weekId });
        return week;
      }

      // Check if all games are final
      const allFinal = await this.areAllGamesFinal(weekId);
      if (!allFinal) {
        throw new Error('Cannot finalize week - not all games are final');
      }

      // Process missing picks first
      await this.processMissingPicks(weekId);

      // Update pick outcomes based on game results
      await this.updatePickOutcomes(weekId);

      // Update week state
      const updatedWeek = await this.db.weeks.update(weekId, {
        state: 'finalized',
        close_at: new Date(),
      });

      // Audit log
      const workspaces = await this.db.workspaces.findAll();
      for (const workspace of workspaces) {
        await this.auditService.log({
          workspace_id: workspace.workspace_id,
          actor_type: actorId ? 'admin' : 'system',
          actor_id: actorId,
          action: 'week_finalized',
          entity_type: 'week',
          entity_id: weekId,
          payload: { week_number: week.week_number },
        });
      }

      // Season rollover: if all weeks in this season are finalized, mark season completed and create upcoming season
      const seasonWeeks = await this.db.weeks.findBySeason(week.season_id);
      const allFinalized = seasonWeeks.every(w => w.state === 'finalized');
      if (allFinalized) {
        // Mark season completed
        await this.db.seasons.update(week.season_id, { state: 'completed' });
        for (const workspace of workspaces) {
          await this.auditService.log({
            workspace_id: workspace.workspace_id,
            actor_type: 'system',
            action: 'season_completed',
            entity_type: 'season',
            entity_id: week.season_id,
            payload: { season_id: week.season_id },
          });
        }

        // Create next season scaffold (upcoming)
        const currentSeason = await this.db.seasons.findByYear(new Date().getFullYear());
        if (currentSeason && currentSeason.season_id === week.season_id) {
          const nextYear = currentSeason.year + 1;
          const existingNext = await this.db.seasons.findByYear(nextYear);
          if (!existingNext) {
            const newSeason = await this.db.seasons.create({ year: nextYear, weeks_count: 18, state: 'upcoming' });
            for (const workspace of workspaces) {
              await this.auditService.log({
                workspace_id: workspace.workspace_id,
                actor_type: 'system',
                action: 'season_initialized',
                entity_type: 'season',
                entity_id: newSeason.season_id,
                payload: { season_id: newSeason.season_id, year: nextYear },
              });
            }
            logger.info('Next season initialized', { year: nextYear, season_id: newSeason.season_id });
          }
        }
      }

      logger.info('Week finalized', { 
        week_id: weekId,
        week_number: week.week_number,
      });

      return updatedWeek;
    } catch (error) {
      logger.error('Failed to finalize week', { error, weekId });
      throw new Error(`Failed to finalize week: ${error}`);
    }
  }

  /**
   * Update pick outcomes based on game results
   */
  private async updatePickOutcomes(weekId: number): Promise<void> {
    try {
      const picks = await this.pickService.getPicksForWeek(weekId);
      const games = await this.db.games.findByWeek(weekId);

      for (const pick of picks) {
        // Find game this team played in
        const game = games.find(g => 
          g.home_team_id === pick.team_id || g.away_team_id === pick.team_id
        );

        if (!game || game.status !== 'final') {
          logger.warn('Game not final for pick', { 
            pick_id: pick.pick_id,
            team_id: pick.team_id,
          });
          continue;
        }

        // Determine outcome
        // Player wins if their team LOST or TIED
        // Player loses if their team WON
        let outcome: 'win' | 'loss';

        if (game.winner_team_id === null) {
          // Tie - per decisions, ties count as losses for the player
          outcome = 'loss';
        } else if (game.winner_team_id === pick.team_id) {
          // Player's team won - player loses
          outcome = 'loss';
        } else {
          // Player's team lost - player wins
          outcome = 'win';
        }

        // Update pick
        await this.db.picks.update(pick.pick_id, {
          outcome,
        });

        logger.debug('Pick outcome updated', { 
          pick_id: pick.pick_id,
          outcome,
        });
      }

      logger.info('Pick outcomes updated', { 
        week_id: weekId,
        picks_updated: picks.length,
      });
    } catch (error) {
      logger.error('Failed to update pick outcomes', { error, weekId });
      throw error;
    }
  }

  /**
   * Get current active week for a season
   */
  async getCurrentWeek(seasonId: number): Promise<Week | null> {
    try {
      const weeks = await this.db.weeks.findBySeason(seasonId);
      
      // Find first week that is open or in_progress
      const currentWeek = weeks.find(w => 
        w.state === 'open' || w.state === 'in_progress'
      );

      if (currentWeek) {
        return currentWeek;
      }

      // If no open week, find next scheduled week
      const nextWeek = weeks.find(w => w.state === 'scheduled');
      return nextWeek || null;
    } catch (error) {
      logger.error('Failed to get current week', { error, seasonId });
      throw new Error(`Failed to get current week: ${error}`);
    }
  }

  /**
   * Check if all games in a week are final
   */
  async areAllGamesFinal(weekId: number): Promise<boolean> {
    try {
      const games = await this.db.games.findByWeek(weekId);
      
      if (games.length === 0) {
        return false;
      }

      return games.every(g => 
        g.status === 'final' || g.status === 'cancelled'
      );
    } catch (error) {
      logger.error('Failed to check if all games are final', { error, weekId });
      throw new Error(`Failed to check if all games are final: ${error}`);
    }
  }

  /**
   * Get week status
   */
  async getWeekStatus(weekId: number): Promise<Week> {
    try {
      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }
      return week;
    } catch (error) {
      logger.error('Failed to get week status', { error, weekId });
      throw new Error(`Failed to get week status: ${error}`);
    }
  }

  /**
   * Send week open announcement to workspace
   * This would integrate with platform adapters (Discord/Slack)
   */
  async sendWeekOpenAnnouncement(weekId: number, workspaceId: number): Promise<void> {
    try {
      logger.debug('Sending week open announcement', { weekId, workspaceId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      const workspace = await this.db.workspaces.findById(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      // TODO: Integrate with platform adapters to send actual message
      // For now, just log the action
      await this.auditService.log({
        workspace_id: workspaceId,
        actor_type: 'system',
        action: 'week_announcement_sent',
        entity_type: 'week',
        entity_id: weekId,
        payload: { week_number: week.week_number },
      });

      logger.info('Week open announcement sent', { 
        week_id: weekId,
        workspace_id: workspaceId,
      });
    } catch (error) {
      logger.error('Failed to send week open announcement', { error, weekId, workspaceId });
      throw new Error(`Failed to send week open announcement: ${error}`);
    }
  }

  /**
   * Process missing picks at week finalization
   * Auto-assigns picks for players who didn't make one
   */
  async processMissingPicks(weekId: number): Promise<void> {
    try {
      logger.debug('Processing missing picks', { weekId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      // Get all players across all workspaces
      const allWorkspaces = await this.db.workspaces.findAll();
      const allPlayers: any[] = [];
      
      for (const workspace of allWorkspaces) {
        const players = await this.db.players.findByWorkspace(workspace.workspace_id);
        
        // Filter players who had joined by this week
        const eligiblePlayers = players.filter(p => {
          if (!p.joined_week_id) return true; // Player was there from start
          // Player joined on or before this week (joined_week_id references week primary key)
          return p.joined_week_id <= week.week_id;
        });
        
        allPlayers.push(...eligiblePlayers);
      }

      const existingPicks = await this.pickService.getPicksForWeek(weekId);
      const playerIdsWithPicks = new Set(existingPicks.map(p => p.player_id));

      // Find players without picks
      const playersWithoutPicks = allPlayers.filter(p => 
        !playerIdsWithPicks.has(p.player_id)
      );

      logger.info('Found players without picks', { 
        week_id: weekId,
        count: playersWithoutPicks.length,
      });

      // Auto-assign picks
      for (const player of playersWithoutPicks) {
        try {
          await this.pickService.assignRandomTeam(player.player_id, weekId);
          logger.debug('Auto-assigned pick', { 
            player_id: player.player_id,
            week_id: weekId,
          });
        } catch (error) {
          logger.error('Failed to auto-assign pick', { 
            error,
            player_id: player.player_id,
            week_id: weekId,
          });
          // Continue with other players even if one fails
        }
      }

      logger.info('Missing picks processed', { 
        week_id: weekId,
        auto_assigned: playersWithoutPicks.length,
      });
    } catch (error) {
      logger.error('Failed to process missing picks', { error, weekId });
      throw new Error(`Failed to process missing picks: ${error}`);
    }
  }
}
