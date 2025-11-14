/**
 * StandingsService Implementation
 * 
 * Handles standings calculation and leaderboard management:
 * - Calculating pick outcomes
 * - Updating player standings
 * - Generating leaderboards
 * - Managing mid-season joins
 */

import { IStandingsService } from './interfaces/IStandingsService';
import { IDatabase } from './interfaces/IDatabase';
import { IAuditService } from './interfaces/IAuditService';
import { Standing, StandingWithPlayer } from '../types';
import { logger } from '../utils/logger';

export class StandingsService implements IStandingsService {
  constructor(
    private db: IDatabase,
    private auditService: IAuditService
  ) {}

  /**
   * Calculate outcomes for all picks in a week
   * Determines win/loss based on game results
   */
  async calculateOutcomes(weekId: number): Promise<void> {
    try {
      logger.debug('Calculating outcomes for week', { weekId });

      const picks = await this.db.picks.findByWeek(weekId);
      const games = await this.db.games.findByWeek(weekId);

      let updatedCount = 0;

      for (const pick of picks) {
        // Find the game this team played in
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

        // Update pick outcome
        await this.db.picks.update(pick.pick_id, { outcome });
        updatedCount++;

        logger.debug('Pick outcome calculated', { 
          pick_id: pick.pick_id,
          team_id: pick.team_id,
          outcome,
        });
      }

      logger.info('Outcomes calculated for week', { 
        week_id: weekId,
        picks_updated: updatedCount,
      });
    } catch (error) {
      logger.error('Failed to calculate outcomes', { error, weekId });
      throw new Error(`Failed to calculate outcomes: ${error}`);
    }
  }

  /**
   * Update standings after week finalization
   * Aggregates pick results into season standings
   */
  async updateStandings(weekId: number): Promise<void> {
    try {
      logger.debug('Updating standings for week', { weekId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      // Get all picks for this week
      const picks = await this.db.picks.findByWeek(weekId);

      // Group picks by player
      const picksByPlayer = new Map<number, typeof picks>();
      for (const pick of picks) {
        if (!picksByPlayer.has(pick.player_id)) {
          picksByPlayer.set(pick.player_id, []);
        }
        picksByPlayer.get(pick.player_id)!.push(pick);
      }

      let updatedCount = 0;

      // Update each player's standing
      for (const [playerId, playerPicks] of picksByPlayer.entries()) {
        // Get or create standing
        let standing = await this.getPlayerRecord(playerId, week.season_id);
        
        if (!standing) {
          // Initialize standing if doesn't exist
          const player = await this.db.players.findById(playerId);
          if (!player) {
            logger.warn('Player not found for standing', { playerId });
            continue;
          }

          standing = await this.initializeStanding(
            playerId, 
            week.season_id, 
            player.joined_week_id || 1
          );
        }

        // Calculate wins and losses from picks
        const wins = playerPicks.filter(p => p.outcome === 'win').length;
        const losses = playerPicks.filter(p => p.outcome === 'loss').length;

        // Update standing
        await this.db.standings.update(standing.standing_id, {
          wins: standing.wins + wins,
          losses: standing.losses + losses,
        });

        updatedCount++;

        logger.debug('Standing updated', { 
          player_id: playerId,
          wins,
          losses,
        });
      }

      // Audit log
      const workspaces = await this.db.workspaces.findAll();
      for (const workspace of workspaces) {
        await this.auditService.log({
          workspace_id: workspace.workspace_id,
          actor_type: 'system',
          action: 'standings_updated',
          entity_type: 'week',
          entity_id: weekId,
          payload: { 
            week_number: week.week_number,
            players_updated: updatedCount,
          },
        });
      }

      logger.info('Standings updated for week', { 
        week_id: weekId,
        players_updated: updatedCount,
      });
    } catch (error) {
      logger.error('Failed to update standings', { error, weekId });
      throw new Error(`Failed to update standings: ${error}`);
    }
  }

  /**
   * Get leaderboard for a season in a workspace
   * Only includes players who joined during or before the current week
   */
  async getLeaderboard(seasonId: number, workspaceId: number): Promise<StandingWithPlayer[]> {
    try {
      logger.debug('Getting leaderboard', { seasonId, workspaceId });

      // Get all players in workspace
      const players = await this.db.players.findByWorkspace(workspaceId);

      // Get standings for all players
      const standingsWithPlayers: StandingWithPlayer[] = [];

      for (const player of players) {
        const standing = await this.getPlayerRecord(player.player_id, seasonId);
        
        if (standing) {
          standingsWithPlayers.push({
            ...standing,
            player,
          });
        }
      }

      // Sort by wins (descending), then by losses (ascending)
      standingsWithPlayers.sort((a, b) => {
        if (a.wins !== b.wins) {
          return b.wins - a.wins; // More wins is better
        }
        return a.losses - b.losses; // Fewer losses is better
      });

      logger.debug('Leaderboard generated', { 
        seasonId,
        workspaceId,
        players: standingsWithPlayers.length,
      });

      return standingsWithPlayers;
    } catch (error) {
      logger.error('Failed to get leaderboard', { error, seasonId, workspaceId });
      throw new Error(`Failed to get leaderboard: ${error}`);
    }
  }

  /**
   * Get individual player record
   */
  async getPlayerRecord(playerId: number, seasonId: number): Promise<Standing | null> {
    try {
      return await this.db.standings.findBySeasonAndPlayer(seasonId, playerId);
    } catch (error) {
      logger.error('Failed to get player record', { error, playerId, seasonId });
      throw new Error(`Failed to get player record: ${error}`);
    }
  }

  /**
   * Initialize standings for a new player in a season
   * Sets joined_week_id to track when they started
   */
  async initializeStanding(
    playerId: number, 
    seasonId: number, 
    joinedWeekId: number
  ): Promise<Standing> {
    try {
      logger.debug('Initializing standing', { playerId, seasonId, joinedWeekId });

      // Check if standing already exists
      const existing = await this.getPlayerRecord(playerId, seasonId);
      if (existing) {
        logger.debug('Standing already exists', { playerId, seasonId });
        return existing;
      }

      const standing = await this.db.standings.create({
        player_id: playerId,
        season_id: seasonId,
        wins: 0,
        losses: 0,
      });

      // Update player's joined_week_id if not set
      const player = await this.db.players.findById(playerId);
      if (player && !player.joined_week_id) {
        await this.db.players.update(playerId, {
          joined_week_id: joinedWeekId,
        });
      }

      // Audit log
      if (player) {
        await this.auditService.log({
          workspace_id: player.workspace_id,
          actor_type: 'system',
          action: 'standing_initialized',
          entity_type: 'standing',
          entity_id: standing.standing_id,
          payload: { player_id: playerId, season_id: seasonId, joined_week_id: joinedWeekId },
        });
      }

      logger.info('Standing initialized', { 
        standing_id: standing.standing_id,
        player_id: playerId,
        season_id: seasonId,
      });

      return standing;
    } catch (error) {
      logger.error('Failed to initialize standing', { error, playerId, seasonId });
      throw new Error(`Failed to initialize standing: ${error}`);
    }
  }

  /**
   * Get player's position in standings
   */
  async getPlayerRank(playerId: number, seasonId: number): Promise<number> {
    try {
      logger.debug('Getting player rank', { playerId, seasonId });

      // Get player's workspace
      const player = await this.db.players.findById(playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      // Get leaderboard
      const leaderboard = await this.getLeaderboard(seasonId, player.workspace_id);

      // Find player's position
      const position = leaderboard.findIndex(s => s.player_id === playerId);

      if (position === -1) {
        throw new Error('Player not found in standings');
      }

      // Return 1-based rank
      return position + 1;
    } catch (error) {
      logger.error('Failed to get player rank', { error, playerId, seasonId });
      throw new Error(`Failed to get player rank: ${error}`);
    }
  }
}
