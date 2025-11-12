import { Standing, StandingWithPlayer } from '../../types';

export interface IStandingsService {
  /**
   * Calculate outcomes for all picks in a week
   */
  calculateOutcomes(weekId: number): Promise<void>;

  /**
   * Update standings after week finalization
   */
  updateStandings(weekId: number): Promise<void>;

  /**
   * Get leaderboard for a season in a workspace
   * Only includes players who joined during or before the current week
   */
  getLeaderboard(seasonId: number, workspaceId: number): Promise<StandingWithPlayer[]>;

  /**
   * Get individual player record
   */
  getPlayerRecord(playerId: number, seasonId: number): Promise<Standing | null>;

  /**
   * Initialize standings for a new player in a season
   * Sets joined_week_id to track when they started
   */
  initializeStanding(playerId: number, seasonId: number, joinedWeekId: number): Promise<Standing>;

  /**
   * Get player's position in standings
   */
  getPlayerRank(playerId: number, seasonId: number): Promise<number>;
}
