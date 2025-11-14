/**
 * Data Provider Interface
 * 
 * Abstraction for external NFL data sources (ESPN, TheSportsDB, etc.)
 * Allows switching between providers without changing business logic
 */

export interface GameData {
  externalId: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  kickoffTime: Date;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
  homeScore: number | null;
  awayScore: number | null;
}

export interface IDataProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Fetch games for a specific week
   * @param weekNumber - Week number (1-18 for regular season)
   * @param seasonYear - Season year (e.g., 2024)
   * @returns Array of game data
   */
  fetchGamesForWeek(weekNumber: number, seasonYear: number): Promise<GameData[]>;

  /**
   * Map provider-specific team identifier to internal slug
   * @param teamId - Provider's team identifier
   * @returns Internal team slug or null if unknown
   */
  mapTeamToSlug(teamId: string): string | null;
}
