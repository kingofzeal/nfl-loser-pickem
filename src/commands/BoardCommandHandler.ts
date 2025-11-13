import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IStandingsService } from '../services/interfaces/IStandingsService';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl board [week] command
 */
export class BoardCommandHandler implements ICommandHandler {
  constructor(
    private standingsService: IStandingsService,
    private renderService: IRenderService,
    private db: IDatabase
  ) {}

  canExecute(context: CommandContext): boolean {
    return true; // All players can view the board
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    // Get active season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No season found for current year.')
      };
    }

    const seasonId = season.season_id;
    const seasonYear = season.year;

    // Parse optional week number
    let weekNumber: number | undefined;
    if (args.length > 0) {
      weekNumber = parseInt(args[0]);
      if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('Invalid week number. Please specify a week between 1 and 18.')
        };
      }
    }

    // Get standings
    const standings = await this.standingsService.getLeaderboard(
      seasonId,
      context.workspace_id
    );

    return {
      type: 'ephemeral',
      content: this.renderService.generateBoard(standings, seasonYear, weekNumber)
    };
  }
}
