/**
 * SchedulerService
 *
 * Handles scheduled jobs and automation:
 * - Week open automation
 * - Reminder system
 * - Game sync jobs
 * - Week finalization triggers
 * - Timezone handling
 * - Job error handling
 */
import { ISchedulerService } from './interfaces/ISchedulerService';
import { IDatabase } from './interfaces/IDatabase';
import { IWeekService } from './interfaces/IWeekService';
import { IGameService } from './interfaces/IGameService';
import { logger } from '../utils/logger';

export class SchedulerService implements ISchedulerService {
  constructor(
    private db: IDatabase,
    private weekService: IWeekService,
    private gameService: IGameService
  ) {}

  /**
   * Run all scheduled jobs (entry point for cron)
   */
  async runScheduledJobs(): Promise<void> {
    try {
      await this.openWeeksIfNeeded();
      await this.sendReminders();
      await this.syncGames();
      await this.finalizeWeeksIfNeeded();
    } catch (error) {
      logger.error('Scheduler jobs failed', { error });
    }
  }

  /**
   * Open weeks that should be open
   * Opens any week in 'scheduled' state where open_at is in the past
   */
  async openWeeksIfNeeded(): Promise<void> {
    const now = new Date();
    const seasons = await this.db.seasons.findByYear(now.getFullYear());
    if (!seasons) return;
    const weeks = await this.db.weeks.findBySeason(seasons.season_id);
    for (const week of weeks) {
      if (week.state === 'scheduled' && week.open_at && new Date(week.open_at) <= now) {
        await this.weekService.openWeek(week.week_id);
        logger.info('Week opened by scheduler', { week_id: week.week_id });
      }
    }
  }

  /**
   * Send reminders to workspaces/players
   * Sends reminders on Friday and Sunday if enabled
   */
  async sendReminders(): Promise<void> {
    const now = new Date();
    const day = now.getUTCDay(); // 5 = Friday, 0 = Sunday
    const workspaces = await this.db.workspaces.findAll();
    for (const workspace of workspaces) {
      if ((day === 5 && workspace.reminder_friday_enabled) || (day === 0 && workspace.reminder_sunday_enabled)) {
        // TODO: Integrate with platform adapters to send reminder messages
        logger.info('Reminder sent', { workspace_id: workspace.workspace_id, day });
      }
    }
  }

  /**
   * Sync games from ESPN for all open/in_progress weeks
   */
  async syncGames(): Promise<void> {
    const now = new Date();
    const seasons = await this.db.seasons.findByYear(now.getFullYear());
    if (!seasons) return;
    const weeks = await this.db.weeks.findBySeason(seasons.season_id);
    for (const week of weeks) {
      if (week.state === 'open' || week.state === 'in_progress') {
        await this.gameService.syncGames(week.week_id);
        logger.info('Games synced by scheduler', { week_id: week.week_id });
      }
    }
  }

  /**
   * Finalize weeks if all games are complete
   */
  async finalizeWeeksIfNeeded(): Promise<void> {
    const now = new Date();
    const seasons = await this.db.seasons.findByYear(now.getFullYear());
    if (!seasons) return;
    const weeks = await this.db.weeks.findBySeason(seasons.season_id);
    for (const week of weeks) {
      if ((week.state === 'in_progress' || week.state === 'open') && week.close_at && new Date(week.close_at) <= now) {
        // Treat weeks with zero games as not finalizable (even though NOT EXISTS would return true)
        const allFinal = await this.db.games.allFinalForWeek(week.week_id);
        if (allFinal) {
          await this.weekService.finalizeWeek(week.week_id);
          logger.info('Week finalized by scheduler', { week_id: week.week_id });
        }
      }
    }
  }
}
