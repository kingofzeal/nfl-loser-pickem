/**
 * GameService Implementation
 *
 * Handles game data synchronization and management via pluggable data providers.
 */

import { IGameService } from './interfaces/IGameService';
import { IDatabase } from './interfaces/IDatabase';
import { IAuditService } from './interfaces/IAuditService';
import { Game, GameWithTeams } from '../types';
import { logger } from '../utils/logger';
import { IDataProvider, GameData } from './interfaces/IDataProvider';

export class GameService implements IGameService {
  constructor(
    private db: IDatabase,
    private auditService: IAuditService,
    private provider: IDataProvider
  ) {}

  /**
   * Sync games from selected provider for a specific week
   */
  async syncGames(weekId: number): Promise<void> {
    try {
      logger.debug('Syncing games', { weekId });

      const week = await this.db.weeks.findById(weekId);
      if (!week) {
        throw new Error('Week not found');
      }

      const season = await this.db.seasons.findByYear(new Date().getFullYear());
      if (!season) {
        throw new Error('Current season not found');
      }

      const gameDataList: GameData[] = await this.provider.fetchGamesForWeek(week.week_number, season.year);

      let successCount = 0;
      let errorCount = 0;

      for (const gameData of gameDataList) {
        try {
          await this.processGameData(gameData, weekId);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error('Failed to process individual game', {
            error,
            externalId: gameData?.externalId,
          });
        }
      }

      logger.info('Games synced', {
        week_id: weekId,
        total: gameDataList.length,
        success: successCount,
        errors: errorCount,
      });

      const workspaces = await this.db.workspaces.findAll();
      for (const workspace of workspaces) {
        await this.auditService.log({
          workspace_id: workspace.workspace_id,
          actor_type: 'system',
          action: 'games_synced',
          entity_type: 'week',
          entity_id: weekId,
          payload: {
            total: gameDataList.length,
            success: successCount,
            errors: errorCount,
          },
        });
      }

      if (errorCount > 0 && successCount === 0) {
        throw new Error('All games failed to sync');
      }
    } catch (error) {
      logger.error('Failed to sync games', { error, weekId });
      throw new Error(`Failed to sync games: ${error}`);
    }
  }

  /**
   * Upsert a single game using normalized provider data
   */
  private async processGameData(gameData: GameData, weekId: number): Promise<void> {
    // Find internal team IDs
    const homeTeam = await this.db.teams.findBySlug(gameData.homeTeamSlug);
    const awayTeam = await this.db.teams.findBySlug(gameData.awayTeamSlug);

    if (!homeTeam || !awayTeam) {
      logger.warn('Teams not found in database', {
        homeSlug: gameData.homeTeamSlug,
        awaySlug: gameData.awayTeamSlug,
      });
      throw new Error(`Teams not found in database: ${gameData.homeTeamSlug}, ${gameData.awayTeamSlug}`);
    }

    const status = gameData.status;
    const kickoffTime = gameData.kickoffTime;
    const homeScore = gameData.homeScore;
    const awayScore = gameData.awayScore;

    // Determine winner
    let winnerTeamId: number | null = null;
    if (status === 'final' && homeScore !== null && awayScore !== null) {
      if (homeScore > awayScore) {
        winnerTeamId = homeTeam.team_id;
      } else if (awayScore > homeScore) {
        winnerTeamId = awayTeam.team_id;
      } else {
        winnerTeamId = null; // tie
      }
    }

    const existingGame = await this.db.games.findByExternalId(gameData.externalId);

    if (existingGame) {
      await this.db.games.update(existingGame.game_id, {
        kickoff_time: kickoffTime,
        status,
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerTeamId,
      });

      logger.debug('Game updated', {
        game_id: existingGame.game_id,
        external_id: gameData.externalId,
        status,
      });
    } else {
      await this.db.games.create({
        week_id: weekId,
        home_team_id: homeTeam.team_id,
        away_team_id: awayTeam.team_id,
        kickoff_time: kickoffTime,
        status,
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerTeamId,
        external_id: gameData.externalId,
      });

      logger.debug('Game created', {
        external_id: gameData.externalId,
        home: gameData.homeTeamSlug,
        away: gameData.awayTeamSlug,
        status,
      });
    }
  }

  /**
   * Update game status and optional scores
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

        if (status === 'final') {
          if (scores.home > scores.away) {
            updateData.winner_team_id = game.home_team_id;
          } else if (scores.away > scores.home) {
            updateData.winner_team_id = game.away_team_id;
          } else {
            updateData.winner_team_id = null; // tie
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

      if (week.state === 'finalized') {
        logger.warn('Game changed after week finalization', {
          game_id: gameId,
          week_id: week.week_id,
        });

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
        const winnerTeam = game.winner_team_id ? await this.db.teams.findById(game.winner_team_id) : null;

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

      const gamesToLock = games.filter(g => new Date(g.kickoff_time) <= now && g.status === 'scheduled');

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
