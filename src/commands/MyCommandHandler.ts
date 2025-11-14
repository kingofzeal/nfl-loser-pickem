import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IStandingsService } from '../services/interfaces/IStandingsService';
import { IWeekService } from '../services/interfaces/IWeekService';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl my command
 */
export class MyCommandHandler implements ICommandHandler {
  constructor(
    private standingsService: IStandingsService,
    private weekService: IWeekService,
    private renderService: IRenderService,
    private db: IDatabase
  ) {}

  canExecute(_context: CommandContext): boolean {
    return true; // All players can view their own summary
  }

  async execute(context: CommandContext, _args: string[]): Promise<CommandResponse> {
    // Get active season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season || season.state !== 'active') {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    const seasonId = season.season_id;

    // Get player's picks for the season
    const picks = await this.db.picks.findBySeason(seasonId, context.player_id);

    // Get player's standing
    let standing = await this.standingsService.getPlayerRecord(context.player_id, seasonId);
    
    if (!standing) {
      // Get current week to track when player joined
      const currentWeek = await this.weekService.getCurrentWeek(seasonId);
      const joinedWeekId = currentWeek ? currentWeek.week_id : 1;
      
      // Initialize standing if not exists
      standing = await this.standingsService.initializeStanding(
        context.player_id, 
        seasonId, 
        joinedWeekId
      );
    }

    // Enrich picks with team and week data
    const picksWithDetails = await Promise.all(
      picks.map(async (pick) => {
        const team = await this.db.teams.findById(pick.team_id);
        const week = await this.db.weeks.findById(pick.week_id);
        return {
          ...pick,
          team: team || undefined,
          week: week || undefined
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
