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
    const activeSeason = await this.db.query<any>(
      'SELECT * FROM seasons WHERE state IN ($1, $2) ORDER BY year DESC LIMIT 1',
      ['active', 'completed']
    );
    
    if (activeSeason.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    const seasonId = activeSeason[0].season_id;
    const seasonYear = activeSeason[0].year;

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
