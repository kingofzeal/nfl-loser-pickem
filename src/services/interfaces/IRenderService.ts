import { EmbedMessage, Pick, Standing, StandingWithPlayer, Week, PickWithDetails } from '../types';

export interface IRenderService {
  /**
   * Generate pick confirmation message
   */
  generatePickConfirmation(pick: Pick, teamName: string, weekNumber: number): EmbedMessage;

  /**
   * Generate player's personal season summary
   */
  generateMySummary(
    playerId: number,
    seasonId: number,
    picks: PickWithDetails[],
    standing: Standing
  ): EmbedMessage;

  /**
   * Generate standings board
   */
  generateBoard(
    standings: StandingWithPlayer[],
    seasonYear: number,
    weekNumber?: number
  ): EmbedMessage;

  /**
   * Generate help message
   */
  generateHelp(): EmbedMessage;

  /**
   * Generate week open announcement
   */
  generateWeekOpenAnnouncement(week: Week, seasonYear: number): EmbedMessage;

  /**
   * Generate weekly summary image
   * @returns URL or buffer of generated image
   */
  generateWeeklySummaryImage(
    seasonYear: number,
    weekNumber: number,
    standings: StandingWithPlayer[],
    allPicks: Record<number, PickWithDetails[]> // keyed by player_id
  ): Promise<string | Buffer>;

  /**
   * Generate error message
   */
  generateError(message: string): EmbedMessage;
}
