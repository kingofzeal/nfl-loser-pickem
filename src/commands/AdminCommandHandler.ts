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
      const weeks = await this.db.weeks.findBySeason(season.season_id);
      
      if (weeks.length === 0) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('No weeks found for current season.')
        };
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const week of weeks) {
        try {
          await this.gameService.syncGames(week.week_id);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Week ${week.week_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const resultText = errorCount > 0
        ? `Synced ${successCount} of ${weeks.length} weeks.\n\n*Errors:*\n${errors.join('\n')}`
        : `Successfully synced all ${successCount} weeks.`;

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
      const weekNumber = parseInt(args[0]);
      if (isNaN(weekNumber)) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('Invalid week number. Use a number or "all".')
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
