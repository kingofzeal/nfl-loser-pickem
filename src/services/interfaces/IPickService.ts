import { Pick, Player, Team, ValidationResult } from '../types';

export interface IPickService {
  /**
   * Validate if a pick can be made
   */
  validatePick(
    playerId: number,
    weekId: number,
    teamId: number
  ): Promise<ValidationResult>;

  /**
   * Create a new pick for a player
   */
  createPick(
    playerId: number,
    weekId: number,
    teamId: number,
    source: 'manual' | 'auto_assigned'
  ): Promise<Pick>;

  /**
   * Change an existing pick (if not locked)
   */
  changePick(
    pickId: number,
    newTeamId: number
  ): Promise<Pick>;

  /**
   * Lock a pick at kickoff time
   */
  lockPick(pickId: number): Promise<Pick>;

  /**
   * Get available teams for a player in a season
   */
  getAvailableTeams(playerId: number, seasonId: number): Promise<Team[]>;

  /**
   * Assign a random winning team to players without picks
   * Assigns from teams that won in that week and haven't been used by the player
   */
  assignRandomTeam(playerId: number, weekId: number): Promise<Pick>;

  /**
   * Check if a pick is locked (game has kicked off)
   */
  isPickLocked(pickId: number): Promise<boolean>;

  /**
   * Unlock picks for a postponed game
   */
  unlockPicksForGame(gameId: number): Promise<void>;

  /**
   * Get player's pick for a specific week
   */
  getPlayerPickForWeek(playerId: number, weekId: number): Promise<Pick | null>;

  /**
   * Get all picks for a week
   */
  getPicksForWeek(weekId: number): Promise<Pick[]>;
}
