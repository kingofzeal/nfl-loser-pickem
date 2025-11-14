import { ICommandHandler, AdminCommand } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IGameService } from '../services/interfaces/IGameService';
import { IWeekService } from '../services/interfaces/IWeekService';
import { IPickService } from '../services/interfaces/IPickService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl admin commands
 */
export class AdminCommandHandler implements ICommandHandler {
  constructor(
    private gameService: IGameService,
    private weekService: IWeekService,
    private pickService: IPickService,
    private renderService: IRenderService,
    private db: IDatabase
  ) {}

  canExecute(context: CommandContext): boolean {
    return context.is_admin; // Only admins can run admin commands
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    if (!this.canExecute(context)) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('You do not have permission to run admin commands.')
      };
    }

    if (args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(
          'Please specify an admin action: seed-season, open-week, finalize-week, set-game, reset-pick, sync, config'
        )
      };
    }

    const subcommand = args[0].toLowerCase();
    const subArgs = args.slice(1);

    switch (subcommand) {
      case AdminCommand.SEED_SEASON:
        return this.seedSeason(context, subArgs);
      case AdminCommand.OPEN_WEEK:
        return this.openWeek(context, subArgs);
      case AdminCommand.FINALIZE_WEEK:
        return this.finalizeWeek(context, subArgs);
      case AdminCommand.SET_GAME:
        return this.setGame(context, subArgs);
      case AdminCommand.RESET_PICK:
        return this.resetPick(context, subArgs);
      case AdminCommand.SYNC:
        return this.sync(context, subArgs);
      case AdminCommand.CONFIG:
        return this.config(context, subArgs);
      default:
        return {
          type: 'ephemeral',
          content: this.renderService.generateError(`Unknown admin command: ${subcommand}`)
        };
    }
  }

  private async seedSeason(_context: CommandContext, _args: string[]): Promise<CommandResponse> {
    if (_args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Please specify a year. Usage: /nfl admin seed-season 2024')
      };
    }

    const year = parseInt(_args[0]);
    if (isNaN(year)) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Invalid year.')
      };
    }

    // TODO: Implement season seeding
    return {
      type: 'ephemeral',
      content: this.renderService.generateError('Season seeding not yet implemented.')
    };
  }

  private async openWeek(context: CommandContext, args: string[]): Promise<CommandResponse> {
    if (args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Please specify a week number. Usage: /nfl admin open-week 1')
      };
    }

    const weekNumber = parseInt(args[0]);
    if (isNaN(weekNumber)) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Invalid week number.')
      };
    }

    // Get active season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season || season.state !== 'active') {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    const week = await this.db.weeks.findBySeasonAndNumber(
      season.season_id,
      weekNumber
    );

    if (!week) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(`Week ${weekNumber} not found.`)
      };
    }

    await this.weekService.openWeek(week.week_id, context.player_id);

    return {
      type: 'ephemeral',
      content: { title: 'Success', description: `Week ${weekNumber} has been opened.` }
    };
  }

  private async finalizeWeek(context: CommandContext, args: string[]): Promise<CommandResponse> {
    if (args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Please specify a week number. Usage: /nfl admin finalize-week 1')
      };
    }

    const weekNumber = parseInt(args[0]);
    if (isNaN(weekNumber)) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Invalid week number.')
      };
    }

    // Get active season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season || season.state !== 'active') {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    const week = await this.db.weeks.findBySeasonAndNumber(
      season.season_id,
      weekNumber
    );

    if (!week) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(`Week ${weekNumber} not found.`)
      };
    }

    await this.weekService.finalizeWeek(week.week_id, context.player_id);

    return {
      type: 'ephemeral',
      content: { title: 'Success', description: `Week ${weekNumber} has been finalized.` }
    };
  }

  private async setGame(_context: CommandContext, _args: string[]): Promise<CommandResponse> {
    // TODO: Implement game override
    return {
      type: 'ephemeral',
      content: this.renderService.generateError('Game override not yet implemented.')
    };
  }

  private async resetPick(_context: CommandContext, _args: string[]): Promise<CommandResponse> {
    // TODO: Implement pick reset
    return {
      type: 'ephemeral',
      content: this.renderService.generateError('Pick reset not yet implemented.')
    };
  }

  private async sync(context: CommandContext, args: string[]): Promise<CommandResponse> {
    // Get current active season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No season found for current year.')
      };
    }

    // Sync all weeks if "all" is specified
    if (args.length > 0 && args[0].toLowerCase() === 'all') {
      const allWeeks = await this.db.weeks.findBySeason(season.season_id);
      
      if (allWeeks.length === 0) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('No weeks found for current season.')
        };
      }

      // Only sync weeks that have started or are about to start (not far-future weeks with no games)
      // This avoids syncing 18 weeks when only 1-12 have game data
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Get the current week number to determine which weeks to sync
      const currentWeekNumber = allWeeks.find(w => w.state === 'open' || w.state === 'in_progress')?.week_number || 1;
      
      // Sync current week and all previous weeks (up to current + 1 for upcoming games)
      const weeks = allWeeks.filter(w => w.week_number <= currentWeekNumber + 1);
      
      if (weeks.length === 0) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('No weeks to sync.')
        };
      }

      // Sync weeks in parallel (in batches to avoid overwhelming ESPN API)
      const BATCH_SIZE = 3; // Sync 3 weeks at a time
      const results: { week: number; success: boolean; error?: string }[] = [];
      
      for (let i = 0; i < weeks.length; i += BATCH_SIZE) {
        const batch = weeks.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (week) => {
          try {
            await this.gameService.syncGames(week.week_id);
            return { week: week.week_number, success: true };
          } catch (error) {
            return {
              week: week.week_number,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      const errors = results.filter(r => !r.success).map(r => `Week ${r.week}: ${r.error}`);

      const skippedCount = allWeeks.length - weeks.length;
      const skippedNote = skippedCount > 0 ? `\n\n_Skipped ${skippedCount} future weeks with no games yet._` : '';

      const resultText = errorCount > 0
        ? `Synced ${successCount} of ${weeks.length} weeks.${skippedNote}\n\n*Errors:*\n${errors.join('\n')}`
        : `Successfully synced all ${successCount} weeks (Weeks 1-${weeks[weeks.length - 1].week_number}).${skippedNote}`;

      return {
        type: 'ephemeral',
        content: { 
          title: errorCount > 0 ? '⚠️ Sync Completed with Errors' : '✅ Sync Complete',
          description: resultText
        }
      };
    }

    // If week number provided, sync that week only
    if (args.length > 0) {
      // Check for range format: "1-11"
      const rangeMatch = args[0].match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const startWeek = parseInt(rangeMatch[1]);
        const endWeek = parseInt(rangeMatch[2]);
        
        if (startWeek > endWeek) {
          return {
            type: 'ephemeral',
            content: this.renderService.generateError('Start week must be less than or equal to end week.')
          };
        }

        const allWeeks = await this.db.weeks.findBySeason(season.season_id);
        const weeks = allWeeks.filter(w => w.week_number >= startWeek && w.week_number <= endWeek);
        
        if (weeks.length === 0) {
          return {
            type: 'ephemeral',
            content: this.renderService.generateError(`No weeks found in range ${startWeek}-${endWeek}.`)
          };
        }

        // Sync weeks in parallel (in batches)
        const BATCH_SIZE = 3;
        const results: { week: number; success: boolean; error?: string }[] = [];
        
        for (let i = 0; i < weeks.length; i += BATCH_SIZE) {
          const batch = weeks.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (week) => {
            try {
              await this.gameService.syncGames(week.week_id);
              return { week: week.week_number, success: true };
            } catch (error) {
              return {
                week: week.week_number,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }

        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;
        const errors = results.filter(r => !r.success).map(r => `Week ${r.week}: ${r.error}`);

        const resultText = errorCount > 0
          ? `Synced ${successCount} of ${weeks.length} weeks (${startWeek}-${endWeek}).\n\n*Errors:*\n${errors.join('\n')}`
          : `Successfully synced weeks ${startWeek}-${endWeek} (${successCount} weeks).`;

        return {
          type: 'ephemeral',
          content: { 
            title: errorCount > 0 ? '⚠️ Sync Completed with Errors' : '✅ Sync Complete',
            description: resultText
          }
        };
      }

      const weekNumber = parseInt(args[0]);
      if (isNaN(weekNumber)) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('Invalid week number. Use a number, range (e.g., "1-11"), or "all".')
        };
      }

      const week = await this.db.weeks.findBySeasonAndNumber(season.season_id, weekNumber);
      if (!week) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError(`Week ${weekNumber} not found.`)
        };
      }

      await this.gameService.syncGames(week.week_id);

      return {
        type: 'ephemeral',
        content: { 
          title: '✅ Sync Complete', 
          description: `Games for Week ${weekNumber} have been synced from ESPN.`
        }
      };
    }

    // Otherwise sync current week
    const weeks = await this.db.weeks.findBySeason(season.season_id);
    const currentWeek = weeks.find(w => w.state === 'open' || w.state === 'in_progress');
    
    if (!currentWeek) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active week found to sync.')
      };
    }

    await this.gameService.syncGames(currentWeek.week_id);

    return {
      type: 'ephemeral',
      content: { 
        title: '✅ Sync Complete', 
        description: `Games for Week ${currentWeek.week_number} have been synced from ESPN.`
      }
    };
  }

  private async config(_context: CommandContext, _args: string[]): Promise<CommandResponse> {
    // TODO: Implement config management
    return {
      type: 'ephemeral',
      content: this.renderService.generateError('Config management not yet implemented.')
    };
  }
}
