import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IStandingsService } from '../services/interfaces/IStandingsService';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl my command
 */
export class MyCommandHandler implements ICommandHandler {
  constructor(
    private standingsService: IStandingsService,
    private renderService: IRenderService,
    private db: IDatabase
  ) {}

  canExecute(context: CommandContext): boolean {
    return true; // All players can view their own summary
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    // Get active season
    const activeSeason = await this.db.query<any>(
      'SELECT * FROM seasons WHERE state = $1 ORDER BY year DESC LIMIT 1',
      ['active']
    );
    
    if (activeSeason.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    const seasonId = activeSeason[0].season_id;

    // Get player's picks for the season
    const picks = await this.db.picks.findBySeason(seasonId, context.player_id);

    // Get player's standing
    let standing = await this.standingsService.getPlayerRecord(context.player_id, seasonId);
    
    if (!standing) {
      // Initialize standing if not exists
      standing = await this.standingsService.initializeStanding(context.player_id, seasonId);
    }

    // Enrich picks with team and week data
    const picksWithDetails = await Promise.all(
      picks.map(async (pick) => {
        const team = await this.db.teams.findById(pick.team_id);
        const week = await this.db.weeks.findById(pick.week_id);
        return {
          ...pick,
          team,
          week
        };
      })
    );

    return {
      type: 'ephemeral',
      content: this.renderService.generateMySummary(
        context.player_id,
        seasonId,
        picksWithDetails,
        standing
      )
    };
  }
}
