/**
 * PickService Implementation
 * 
 * Handles all pick-related business logic including:
 * - Pick validation (no repeats, team plays in week, week is open)
 * - Pick creation and changes
 * - Pick locking at kickoff
 * - Auto-assignment for missing picks
 */

import { IPickService } from './interfaces/IPickService';
import { IDatabase } from './interfaces/IDatabase';
import { IAuditService } from './interfaces/IAuditService';
import { Pick, Team, ValidationResult } from '../types';
import { logger } from '../utils/logger';

export class PickService implements IPickService {
  constructor(
    private db: IDatabase,
    private auditService: IAuditService
  ) {}

  /**
   * Validate if a pick can be made
   * Checks:
   * 1. Player hasn't already used this team this season
   * 2. Team plays in this week
   * 3. Week is still open (not locked)
   * 4. Player doesn't already have a pick for this week
   */
  async validatePick(
    playerId: number,
    weekId: number,
    teamId: number,
    excludePickId?: number
  ): Promise<ValidationResult> {
    try {
      logger.debug('Validating pick', { playerId, weekId, teamId, excludePickId });

      // Get week details
      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        return { valid: false, error: 'Week not found' };
      }

      // Check if week is open
      if (week.state !== 'open') {
        return { valid: false, error: 'Week is not open for picks' };
      }

      // Check if player already has a pick for this week (excluding the pick being changed)
      const existingPick = await this.getPlayerPickForWeek(playerId, weekId);
      if (existingPick && existingPick.pick_id !== excludePickId) {
        return { valid: false, error: 'You already have a pick for this week' };
      }

      // Check if team has already been used by this player this season
      const player = await this.db.players.findById(playerId);
      if (!player) {
        return { valid: false, error: 'Player not found' };
      }

      const usedTeams = await this.getUsedTeamsByPlayer(playerId, week.season_id, excludePickId);
      if (usedTeams.some(t => t.team_id === teamId)) {
        return { valid: false, error: 'You have already used this team this season' };
      }

      // Check if team plays in this week
      const games = await this.db.games.findByWeek(weekId);
      const teamPlays = games.some(g => 
        g.home_team_id === teamId || g.away_team_id === teamId
      );

      if (!teamPlays) {
        return { valid: false, error: 'This team does not play in this week' };
      }

      // Check if any game this team plays in has already started
      const teamGames = games.filter(g => 
        g.home_team_id === teamId || g.away_team_id === teamId
      );
      const now = new Date();
      const gameStarted = teamGames.some(g => new Date(g.kickoff_time) <= now);

      if (gameStarted) {
        return { valid: false, error: 'This team\'s game has already started' };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Pick validation failed', { error, playerId, weekId, teamId });
      throw new Error(`Pick validation failed: ${error}`);
    }
  }

  /**
   * Get teams already used by a player in a season
   */
  private async getUsedTeamsByPlayer(playerId: number, seasonId: number, excludePickId?: number): Promise<Team[]> {
    // Get all weeks in season
    const weeks = await this.db.weeks.findBySeason(seasonId);
    const weekIds = weeks.map(w => w.week_id);

    // Get all picks by player in these weeks
    const allPicks: Pick[] = [];
    for (const weekId of weekIds) {
      const pick = await this.getPlayerPickForWeek(playerId, weekId);
      if (pick && pick.pick_id !== excludePickId) {
        allPicks.push(pick);
      }
    }

    // Get unique team IDs
    const teamIds = [...new Set(allPicks.map(p => p.team_id))];

    // Fetch team details
    const teams: Team[] = [];
    for (const teamId of teamIds) {
      const team = await this.db.teams.findById(teamId);
      if (team) {
        teams.push(team);
      }
    }

    return teams;
  }

  /**
   * Create a new pick for a player
   */
  async createPick(
    playerId: number,
    weekId: number,
    teamId: number,
    source: 'manual' | 'auto_assigned'
  ): Promise<Pick> {
    try {
      logger.debug('Creating pick', { playerId, weekId, teamId, source });

      // Validate pick (skip for auto-assigned as they're system-generated)
      if (source === 'manual') {
        const validation = await this.validatePick(playerId, weekId, teamId);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // Create pick
      const pick = await this.db.picks.create({
        player_id: playerId,
        week_id: weekId,
        team_id: teamId,
        source,
        locked_at: null,
        outcome: null,
      });

      // Get player and workspace info for audit log
      const player = await this.db.players.findById(playerId);
      if (player) {
        await this.auditService.log({
          workspace_id: player.workspace_id,
          actor_type: source === 'auto_assigned' ? 'system' : 'player',
          actor_id: source === 'auto_assigned' ? undefined : playerId,
          action: 'pick_created',
          entity_type: 'pick',
          entity_id: pick.pick_id,
          payload: { player_id: playerId, week_id: weekId, team_id: teamId, source },
        });
      }

      logger.info('Pick created', { 
        pick_id: pick.pick_id,
        player_id: playerId,
        week_id: weekId,
        team_id: teamId,
        source,
      });

      return pick;
    } catch (error) {
      logger.error('Failed to create pick', { error, playerId, weekId, teamId });
      throw new Error(`Failed to create pick: ${error}`);
    }
  }

  /**
   * Change an existing pick (if not locked)
   */
  async changePick(pickId: number, newTeamId: number): Promise<Pick> {
    try {
      logger.debug('Changing pick', { pickId, newTeamId });

      // Get existing pick
      const existingPick = await this.db.picks.findById(pickId);
      if (!existingPick) {
        throw new Error('Pick not found');
      }

      // Check if pick is locked
      if (existingPick.locked_at) {
        throw new Error('Pick is locked and cannot be changed');
      }

      // Validate new team selection (exclude current pick from validation)
      const validation = await this.validatePick(
        existingPick.player_id,
        existingPick.week_id,
        newTeamId,
        pickId
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Update pick
      const updatedPick = await this.db.picks.update(pickId, {
        team_id: newTeamId,
      });

      // Audit log
      const player = await this.db.players.findById(existingPick.player_id);
      if (player) {
        await this.auditService.log({
          workspace_id: player.workspace_id,
          actor_type: 'player',
          actor_id: existingPick.player_id,
          action: 'pick_changed',
          entity_type: 'pick',
          entity_id: pickId,
          payload: { 
            old_team_id: existingPick.team_id, 
            new_team_id: newTeamId,
          },
        });
      }

      logger.info('Pick changed', { 
        pick_id: pickId,
        old_team_id: existingPick.team_id,
        new_team_id: newTeamId,
      });

      return updatedPick;
    } catch (error) {
      logger.error('Failed to change pick', { error, pickId, newTeamId });
      throw new Error(`Failed to change pick: ${error}`);
    }
  }

  /**
   * Lock a pick at kickoff time
   */
  async lockPick(pickId: number): Promise<Pick> {
    try {
      logger.debug('Locking pick', { pickId });

      const pick = await this.db.picks.findById(pickId);
      if (!pick) {
        throw new Error('Pick not found');
      }

      if (pick.locked_at) {
        logger.debug('Pick already locked', { pickId });
        return pick;
      }

      const lockedPick = await this.db.picks.update(pickId, {
        locked_at: new Date(),
      });

      logger.info('Pick locked', { pick_id: pickId });

      return lockedPick;
    } catch (error) {
      logger.error('Failed to lock pick', { error, pickId });
      throw new Error(`Failed to lock pick: ${error}`);
    }
  }

  /**
   * Get available teams for a player in a season
   * Returns teams that haven't been used yet
   */
  async getAvailableTeams(playerId: number, seasonId: number): Promise<Team[]> {
    try {
      logger.debug('Getting available teams', { playerId, seasonId });

      const allTeams = await this.db.teams.findAll();
      const usedTeams = await this.getUsedTeamsByPlayer(playerId, seasonId);
      const usedTeamIds = new Set(usedTeams.map(t => t.team_id));

      const availableTeams = allTeams.filter(t => !usedTeamIds.has(t.team_id));

      logger.debug('Available teams fetched', { 
        playerId, 
        seasonId,
        total: allTeams.length,
        used: usedTeams.length,
        available: availableTeams.length,
      });

      return availableTeams;
    } catch (error) {
      logger.error('Failed to get available teams', { error, playerId, seasonId });
      throw new Error(`Failed to get available teams: ${error}`);
    }
  }

  /**
   * Assign a random winning team to players without picks
   * Per decisions: assigns from teams that won in that week and haven't been used by the player
   */
  async assignRandomTeam(playerId: number, weekId: number): Promise<Pick> {
    try {
      logger.debug('Assigning random team', { playerId, weekId });

      // Get week and season info
      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      // Get all games for this week
      const games = await this.db.games.findByWeek(weekId);

      // Filter to completed games with winners
      const completedGames = games.filter(g => 
        g.status === 'final' && g.winner_team_id !== null
      );

      if (completedGames.length === 0) {
        throw new Error('No completed games with winners in this week');
      }

      // Get winning team IDs
      const winningTeamIds = completedGames
        .map(g => g.winner_team_id!)
        .filter(id => id !== null);

      // Get teams available to this player
      const availableTeams = await this.getAvailableTeams(playerId, week.season_id);
      const availableTeamIds = new Set(availableTeams.map(t => t.team_id));

      // Filter to winning teams that are still available
      const eligibleTeamIds = winningTeamIds.filter(id => availableTeamIds.has(id));

      if (eligibleTeamIds.length === 0) {
        // Fallback: if no winning teams available, pick any available team
        logger.warn('No winning teams available for player, using fallback', { 
          playerId, 
          weekId,
        });
        
        if (availableTeams.length === 0) {
          throw new Error('No teams available for player');
        }

        const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
        return await this.createPick(playerId, weekId, randomTeam.team_id, 'auto_assigned');
      }

      // Pick random winning team
      const randomTeamId = eligibleTeamIds[Math.floor(Math.random() * eligibleTeamIds.length)];

      logger.info('Auto-assigning random winning team', { 
        playerId, 
        weekId, 
        teamId: randomTeamId,
      });

      return await this.createPick(playerId, weekId, randomTeamId, 'auto_assigned');
    } catch (error) {
      logger.error('Failed to assign random team', { error, playerId, weekId });
      throw new Error(`Failed to assign random team: ${error}`);
    }
  }

  /**
   * Check if a pick is locked (game has kicked off)
   */
  async isPickLocked(pickId: number): Promise<boolean> {
    try {
      const pick = await this.db.picks.findById(pickId);
      if (!pick) {
        throw new Error('Pick not found');
      }

      return pick.locked_at !== null;
    } catch (error) {
      logger.error('Failed to check pick lock status', { error, pickId });
      throw new Error(`Failed to check pick lock status: ${error}`);
    }
  }

  /**
   * Unlock picks for a postponed game
   * When a game is postponed, players who picked teams in that game should be able to change
   */
  async unlockPicksForGame(gameId: number): Promise<void> {
    try {
      logger.debug('Unlocking picks for game', { gameId });

      const game = await this.db.games.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      // Get all picks for this week
      const picks = await this.getPicksForWeek(game.week_id);

      // Filter to picks for teams in this game
      const relevantPicks = picks.filter(p => 
        p.team_id === game.home_team_id || p.team_id === game.away_team_id
      );

      // Unlock each pick
      for (const pick of relevantPicks) {
        await this.db.picks.update(pick.pick_id, {
          locked_at: null,
        });

        // Audit log
        const player = await this.db.players.findById(pick.player_id);
        if (player) {
          await this.auditService.log({
            workspace_id: player.workspace_id,
            actor_type: 'system',
            action: 'pick_unlocked',
            entity_type: 'pick',
            entity_id: pick.pick_id,
            payload: { reason: 'game_postponed', game_id: gameId },
          });
        }
      }

      logger.info('Picks unlocked for postponed game', { 
        gameId, 
        picksUnlocked: relevantPicks.length,
      });
    } catch (error) {
      logger.error('Failed to unlock picks for game', { error, gameId });
      throw new Error(`Failed to unlock picks for game: ${error}`);
    }
  }

  /**
   * Get player's pick for a specific week
   */
  async getPlayerPickForWeek(playerId: number, weekId: number): Promise<Pick | null> {
    try {
      return await this.db.picks.findByWeekAndPlayer(weekId, playerId);
    } catch (error) {
      logger.error('Failed to get player pick for week', { error, playerId, weekId });
      throw new Error(`Failed to get player pick for week: ${error}`);
    }
  }

  /**
   * Get all picks for a week
   */
  async getPicksForWeek(weekId: number): Promise<Pick[]> {
    try {
      return await this.db.picks.findByWeek(weekId);
    } catch (error) {
      logger.error('Failed to get picks for week', { error, weekId });
      throw new Error(`Failed to get picks for week: ${error}`);
    }
  }
}
