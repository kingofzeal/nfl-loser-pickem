/**
 * GameService Implementation
 * 
 * Handles game data synchronization and management:
 * - Sync games from ESPN API
 * - Update game statuses and scores
 * - Determine winners
 * - Trigger recalculations when needed
 */

import { IGameService } from './interfaces/IGameService';
import { IDatabase } from './interfaces/IDatabase';
import { IAuditService } from './interfaces/IAuditService';
import { Game, GameWithTeams, ESPNScoreboardResponse } from '../types';
import { ESPN_TEAM_MAP } from '../utils/team-mappings';
import { logger } from '../utils/logger';

export class GameService implements IGameService {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

  constructor(
    private db: IDatabase,
    private auditService: IAuditService
  ) {}

  /**
   * Sync games from ESPN API for a specific week
   */
  async syncGames(weekId: number): Promise<void> {
    try {
      logger.debug('Syncing games from ESPN', { weekId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      const season = await this.db.seasons.findByYear(new Date().getFullYear());
      if (!season) {
        throw new Error('Current season not found');
      }

      // Fetch scoreboard from ESPN
      const url = `${this.ESPN_API_BASE}?week=${week.week_number}&seasontype=2&limit=100`;
      logger.debug('Fetching ESPN scoreboard', { url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API request failed: ${response.statusText}`);
      }

      const data: ESPNScoreboardResponse = await response.json();

      logger.info('ESPN data fetched', { 
        week: data.week.number,
        games: data.events.length,
      });

      // Process each game
      for (const espnGame of data.events) {
        await this.processESPNGame(espnGame, weekId);
      }

      logger.info('Games synced', { 
        week_id: weekId,
        games_processed: data.events.length,
      });
    } catch (error) {
      logger.error('Failed to sync games', { error, weekId });
      throw new Error(`Failed to sync games: ${error}`);
    }
  }

  /**
   * Process a single ESPN game and update/create in database
   */
  private async processESPNGame(espnGame: any, weekId: number): Promise<void> {
    try {
      // Extract competition (first one, should only be one for NFL games)
      const competition = espnGame.competitions?.[0];
      if (!competition) {
        logger.warn('No competition data in ESPN game', { gameId: espnGame.id });
        return;
      }

      // Get home and away teams
      const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) {
        logger.warn('Missing competitors in ESPN game', { gameId: espnGame.id });
        return;
      }

      // Map ESPN team IDs to internal slugs
      const homeSlug = ESPN_TEAM_MAP[homeCompetitor.team.id];
      const awaySlug = ESPN_TEAM_MAP[awayCompetitor.team.id];

      if (!homeSlug || !awaySlug) {
        logger.warn('Unknown team IDs in ESPN game', { 
          gameId: espnGame.id,
          homeTeamId: homeCompetitor.team.id,
          awayTeamId: awayCompetitor.team.id,
        });
        return;
      }

      // Find internal team IDs
      const homeTeam = await this.db.teams.findBySlug(homeSlug);
      const awayTeam = await this.db.teams.findBySlug(awaySlug);

      if (!homeTeam || !awayTeam) {
        logger.warn('Teams not found in database', { 
          homeSlug,
          awaySlug,
        });
        return;
      }

      // Parse game status
      const status = this.mapESPNStatus(espnGame.status.type.name);
      const kickoffTime = new Date(espnGame.date);

      // Parse scores
      const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score, 10) : null;
      const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score, 10) : null;

      // Determine winner
      let winnerTeamId: number | null = null;
      if (status === 'final' && homeScore !== null && awayScore !== null) {
        if (homeScore > awayScore) {
          winnerTeamId = homeTeam.team_id;
        } else if (awayScore > homeScore) {
          winnerTeamId = awayTeam.team_id;
        }
        // If scores are equal, winnerTeamId stays null (tie)
      }

      // Check if game already exists
      const existingGame = await this.db.games.findByExternalId(espnGame.id);

      if (existingGame) {
        // Update existing game
        await this.db.games.update(existingGame.game_id, {
          kickoff_time: kickoffTime,
          status,
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id: winnerTeamId,
        });

        logger.debug('Game updated', { 
          game_id: existingGame.game_id,
          external_id: espnGame.id,
          status,
        });
      } else {
        // Create new game
        await this.db.games.create({
          week_id: weekId,
          home_team_id: homeTeam.team_id,
          away_team_id: awayTeam.team_id,
          kickoff_time: kickoffTime,
          status,
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id: winnerTeamId,
          external_id: espnGame.id,
        });

        logger.debug('Game created', { 
          external_id: espnGame.id,
          home: homeSlug,
          away: awaySlug,
          status,
        });
      }
    } catch (error) {
      logger.error('Failed to process ESPN game', { error, gameId: espnGame.id });
      // Don't throw - continue processing other games
    }
  }

  /**
   * Map ESPN status to our internal status
   */
  private mapESPNStatus(espnStatus: string): 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled' {
    const normalized = espnStatus.toLowerCase();
    
    if (normalized.includes('scheduled') || normalized.includes('pre')) {
      return 'scheduled';
    }
    if (normalized.includes('in progress') || normalized.includes('halftime')) {
      return 'in_progress';
    }
    if (normalized.includes('final')) {
      return 'final';
    }
    if (normalized.includes('postponed') || normalized.includes('delayed')) {
      return 'postponed';
    }
    if (normalized.includes('cancelled')) {
      return 'cancelled';
    }

    // Default to in_progress if we can't determine
    logger.warn('Unknown ESPN status, defaulting to in_progress', { espnStatus });
    return 'in_progress';
  }

  /**
   * Update game status
   */
  async updateGameStatus(
    gameId: number, 
    status: string, 
    scores?: { home: number; away: number }
  ): Promise<Game> {
    try {
      logger.debug('Updating game status', { gameId, status, scores });

      const game = await this.db.games.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const updateData: Partial<Game> = { 
        status: status as any,
      };

      if (scores) {
        updateData.home_score = scores.home;
        updateData.away_score = scores.away;

        // Determine winner if game is final
        if (status === 'final') {
          if (scores.home > scores.away) {
            updateData.winner_team_id = game.home_team_id;
          } else if (scores.away > scores.home) {
            updateData.winner_team_id = game.away_team_id;
          } else {
            updateData.winner_team_id = null; // Tie
          }
        }
      }

      const updatedGame = await this.db.games.update(gameId, updateData);

      logger.info('Game status updated', { 
        game_id: gameId,
        status,
        winner_team_id: updateData.winner_team_id,
      });

      return updatedGame;
    } catch (error) {
      logger.error('Failed to update game status', { error, gameId, status });
      throw new Error(`Failed to update game status: ${error}`);
    }
  }

  /**
   * Set game winner
   */
  async setWinner(gameId: number, winnerTeamId: number | null): Promise<Game> {
    try {
      logger.debug('Setting game winner', { gameId, winnerTeamId });

      const game = await this.db.games.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const updatedGame = await this.db.games.update(gameId, {
        winner_team_id: winnerTeamId,
        status: 'final',
      });

      logger.info('Game winner set', { 
        game_id: gameId,
        winner_team_id: winnerTeamId,
      });

      return updatedGame;
    } catch (error) {
      logger.error('Failed to set game winner', { error, gameId });
      throw new Error(`Failed to set game winner: ${error}`);
    }
  }

  /**
   * Trigger recalculation if game status changes after finalization
   * This handles cases where a game result changes after initial finalization
   */
  async triggerRecalculation(gameId: number): Promise<void> {
    try {
      logger.debug('Triggering recalculation', { gameId });

      const game = await this.db.games.findById(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const week = await this.db.weeks.findById(game.week_id);
      if (!week) {
        throw new Error('Week not found');
      }

      // If week was finalized, we need to recalculate
      if (week.state === 'finalized') {
        logger.warn('Game changed after week finalization', { 
          game_id: gameId,
          week_id: week.week_id,
        });

        // Note: This would trigger a recalculation in a real implementation
        // For now, just log the event
        const workspaces = await this.db.workspaces.findAll();
        for (const workspace of workspaces) {
          await this.auditService.log({
            workspace_id: workspace.workspace_id,
            actor_type: 'system',
            action: 'game_recalculation_triggered',
            entity_type: 'game',
            entity_id: gameId,
            payload: { 
              week_id: week.week_id,
              reason: 'game_result_changed_after_finalization',
            },
          });
        }
      }

      logger.info('Recalculation triggered', { game_id: gameId });
    } catch (error) {
      logger.error('Failed to trigger recalculation', { error, gameId });
      throw new Error(`Failed to trigger recalculation: ${error}`);
    }
  }

  /**
   * Get games for a week with team details
   */
  async getGamesForWeek(weekId: number): Promise<GameWithTeams[]> {
    try {
      logger.debug('Getting games for week', { weekId });

      const games = await this.db.games.findByWeek(weekId);
      const gamesWithTeams: GameWithTeams[] = [];

      for (const game of games) {
        const homeTeam = await this.db.teams.findById(game.home_team_id);
        const awayTeam = await this.db.teams.findById(game.away_team_id);
        const winnerTeam = game.winner_team_id 
          ? await this.db.teams.findById(game.winner_team_id)
          : null;

        if (!homeTeam || !awayTeam) {
          logger.warn('Missing team data for game', { gameId: game.game_id });
          continue;
        }

        gamesWithTeams.push({
          ...game,
          home_team: homeTeam,
          away_team: awayTeam,
          winner_team: winnerTeam,
        });
      }

      logger.debug('Games with teams fetched', { 
        weekId,
        count: gamesWithTeams.length,
      });

      return gamesWithTeams;
    } catch (error) {
      logger.error('Failed to get games for week', { error, weekId });
      throw new Error(`Failed to get games for week: ${error}`);
    }
  }

  /**
   * Check if any games in a week have kicked off
   */
  async hasWeekStarted(weekId: number): Promise<boolean> {
    try {
      const games = await this.db.games.findByWeek(weekId);
      const now = new Date();

      return games.some(g => new Date(g.kickoff_time) <= now);
    } catch (error) {
      logger.error('Failed to check if week started', { error, weekId });
      throw new Error(`Failed to check if week started: ${error}`);
    }
  }

  /**
   * Get games that should be locked (kickoff time passed)
   */
  async getGamesToLock(weekId: number): Promise<Game[]> {
    try {
      logger.debug('Getting games to lock', { weekId });

      const games = await this.db.games.findByWeek(weekId);
      const now = new Date();

      const gamesToLock = games.filter(g => 
        new Date(g.kickoff_time) <= now && 
        g.status === 'scheduled'
      );

      logger.debug('Games to lock identified', { 
        weekId,
        count: gamesToLock.length,
      });

      return gamesToLock;
    } catch (error) {
      logger.error('Failed to get games to lock', { error, weekId });
      throw new Error(`Failed to get games to lock: ${error}`);
    }
  }
}
