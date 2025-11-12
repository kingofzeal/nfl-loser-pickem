import { Game, GameWithTeams } from '../../types';

export interface IGameService {
  /**
   * Sync games from external API
   */
  syncGames(weekId: number): Promise<void>;

  /**
   * Update game status
   */
  updateGameStatus(gameId: number, status: string, scores?: { home: number; away: number }): Promise<Game>;

  /**
   * Set game winner
   */
  setWinner(gameId: number, winnerTeamId: number | null): Promise<Game>;

  /**
   * Trigger recalculation if game status changes after finalization
   */
  triggerRecalculation(gameId: number): Promise<void>;

  /**
   * Get games for a week with team details
   */
  getGamesForWeek(weekId: number): Promise<GameWithTeams[]>;

  /**
   * Check if any games in a week have kicked off
   */
  hasWeekStarted(weekId: number): Promise<boolean>;

  /**
   * Get games that should be locked (kickoff time passed)
   */
  getGamesToLock(weekId: number): Promise<Game[]>;
}
