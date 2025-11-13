/**
 * ISchedulerService
 *
 * Interface for scheduled jobs and automation.
 */
export interface ISchedulerService {
  /**
   * Run all scheduled jobs (entry point for cron)
   */
  runScheduledJobs(): Promise<void>;

  /**
   * Open weeks that should be open
   */
  openWeeksIfNeeded(): Promise<void>;

  /**
   * Send reminders to workspaces/players
   */
  sendReminders(): Promise<void>;

  /**
   * Sync games from ESPN
   */
  syncGames(): Promise<void>;

  /**
   * Finalize weeks if all games are complete
   */
  finalizeWeeksIfNeeded(): Promise<void>;
}
