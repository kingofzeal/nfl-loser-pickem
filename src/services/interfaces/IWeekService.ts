import { Week } from '../../types';

export interface IWeekService {
  /**
   * Open a week for picks (manually or scheduled)
   */
  openWeek(weekId: number, actorId?: number): Promise<Week>;

  /**
   * Close individual games at kickoff
   */
  closeGames(weekId: number): Promise<void>;

  /**
   * Finalize a week after all games are complete
   */
  finalizeWeek(weekId: number, actorId?: number): Promise<Week>;

  /**
   * Get current active week for a season
   */
  getCurrentWeek(seasonId: number): Promise<Week | null>;

  /**
   * Check if all games in a week are final
   */
  areAllGamesFinal(weekId: number): Promise<boolean>;

  /**
   * Get week status
   */
  getWeekStatus(weekId: number): Promise<Week>;

  /**
   * Send week open announcement to workspace
   */
  sendWeekOpenAnnouncement(weekId: number, workspaceId: number): Promise<void>;

  /**
   * Process missing picks at week finalization
   */
  processMissingPicks(weekId: number): Promise<void>;
}
