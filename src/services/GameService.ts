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
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly REQUEST_TIMEOUT_MS = 10000;

  constructor(
    private db: IDatabase,
    private auditService: IAuditService
  ) {}

  /**
   * Fetch with retry and timeout
   */
  private async fetchWithRetry(url: string, retries = this.MAX_RETRIES): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug('Fetching ESPN data', { url, attempt });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          return response;
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : this.RETRY_DELAY_MS * Math.pow(2, attempt);
          
          logger.warn('Rate limited by ESPN API', { 
            attempt, 
            retryAfter: delayMs,
            status: response.status,
          });

          if (attempt < retries) {
            await this.sleep(delayMs);
            continue;
          }
        }

        // Handle server errors (5xx)
        if (response.status >= 500) {
          logger.warn('ESPN API server error', { 
            attempt, 
            status: response.status,
            statusText: response.statusText,
          });

          if (attempt < retries) {
            await this.sleep(this.RETRY_DELAY_MS * Math.pow(2, attempt));
            continue;
          }
        }

        // Client error (4xx) - don't retry
        throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          logger.warn('ESPN API request timed out', { attempt, timeout: this.REQUEST_TIMEOUT_MS });
        } else {
          logger.warn('ESPN API request error', { attempt, error: error.message });
        }

        if (attempt === retries) {
          throw error;
        }

        await this.sleep(this.RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }

    throw new Error('ESPN API request failed after all retries');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

      // Fetch scoreboard from ESPN with retry
      const url = `${this.ESPN_API_BASE}?week=${week.week_number}&seasontype=2&limit=100`;
      logger.debug('Fetching ESPN scoreboard', { url });

      const response = await this.fetchWithRetry(url);
      const data: ESPNScoreboardResponse = await response.json();

      logger.info('ESPN data fetched', { 
        week: data.week.number,
        games: data.events.length,
      });

      // Validate response structure
      if (!data.events || !Array.isArray(data.events)) {
        logger.error('Invalid ESPN API response structure', { data });
        throw new Error('Invalid ESPN API response: missing or invalid events array');
      }

      // Process each game
      let successCount = 0;
      let errorCount = 0;

      for (const espnGame of data.events) {
        try {
          await this.processESPNGame(espnGame, weekId);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error('Failed to process individual game', { 
            error, 
            gameId: espnGame?.id,
          });
          // Continue processing other games
        }
      }

      logger.info('Games synced', { 
        week_id: weekId,
        total: data.events.length,
        success: successCount,
        errors: errorCount,
      });

      // Log audit entry for sync
      const workspaces = await this.db.workspaces.findAll();
      for (const workspace of workspaces) {
        await this.auditService.log({
          workspace_id: workspace.workspace_id,
          actor_type: 'system',
          action: 'games_synced',
          entity_type: 'week',
          entity_id: weekId,
          payload: {
            total: data.events.length,
            success: successCount,
            errors: errorCount,
          },
        });
      }

      // If all games failed, throw error
      if (errorCount > 0 && successCount === 0) {
        throw new Error('All games failed to sync');
      }
    } catch (error) {
      logger.error('Failed to sync games', { error, weekId });
      throw new Error(`Failed to sync games: ${error}`);
    }
  }

  /**
   * Process a single ESPN game and update/create in database
   */
  private async processESPNGame(espnGame: any, weekId: number): Promise<void> {
    // Validate game structure
    if (!espnGame || !espnGame.id) {
      logger.warn('Invalid ESPN game: missing id', { espnGame });
      throw new Error('Invalid ESPN game: missing id');
    }

    try {
      // Extract competition (first one, should only be one for NFL games)
      const competition = espnGame.competitions?.[0];
      if (!competition) {
        logger.warn('No competition data in ESPN game', { gameId: espnGame.id });
        throw new Error('No competition data in ESPN game');
      }

      // Validate competitors array
      if (!competition.competitors || !Array.isArray(competition.competitors)) {
        logger.warn('Invalid competitors data in ESPN game', { gameId: espnGame.id });
        throw new Error('Invalid competitors data');
      }

      // Get home and away teams
      const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) {
        logger.warn('Missing competitors in ESPN game', { gameId: espnGame.id });
        throw new Error('Missing home or away competitor');
      }

      // Validate team data
      if (!homeCompetitor.team?.id || !awayCompetitor.team?.id) {
        logger.warn('Missing team IDs in ESPN game', { gameId: espnGame.id });
        throw new Error('Missing team IDs');
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
        throw new Error(`Unknown team IDs: ${homeCompetitor.team.id}, ${awayCompetitor.team.id}`);
      }

      // Find internal team IDs
      const homeTeam = await this.db.teams.findBySlug(homeSlug);
      const awayTeam = await this.db.teams.findBySlug(awaySlug);

      if (!homeTeam || !awayTeam) {
        logger.warn('Teams not found in database', { 
          homeSlug,
          awaySlug,
        });
        throw new Error(`Teams not found in database: ${homeSlug}, ${awaySlug}`);
      }

      // Validate and parse game status
      if (!espnGame.status?.type?.name) {
        logger.warn('Missing status in ESPN game', { gameId: espnGame.id });
        throw new Error('Missing game status');
      }

      const status = this.mapESPNStatus(espnGame.status.type.name);

      // Validate and parse kickoff time
      if (!espnGame.date) {
        logger.warn('Missing date in ESPN game', { gameId: espnGame.id });
        throw new Error('Missing game date');
      }

      const kickoffTime = new Date(espnGame.date);
      if (isNaN(kickoffTime.getTime())) {
        logger.warn('Invalid date in ESPN game', { 
          gameId: espnGame.id,
          date: espnGame.date,
        });
        throw new Error(`Invalid game date: ${espnGame.date}`);
      }

      // Parse scores (with validation)
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      if (homeCompetitor.score) {
        homeScore = parseInt(homeCompetitor.score, 10);
        if (isNaN(homeScore) || homeScore < 0) {
          logger.warn('Invalid home score', { 
            gameId: espnGame.id, 
            score: homeCompetitor.score,
          });
          homeScore = null;
        }
      }

      if (awayCompetitor.score) {
        awayScore = parseInt(awayCompetitor.score, 10);
        if (isNaN(awayScore) || awayScore < 0) {
          logger.warn('Invalid away score', { 
            gameId: espnGame.id, 
            score: awayCompetitor.score,
          });
          awayScore = null;
        }
      }

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
      throw error; // Re-throw to be caught by syncGames
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
