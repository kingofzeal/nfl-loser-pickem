import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IPickService } from '../services/interfaces/IPickService';
import { IWeekService } from '../services/interfaces/IWeekService';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl pick TEAM command
 */
export class PickCommandHandler implements ICommandHandler {
  constructor(
    private pickService: IPickService,
    private weekService: IWeekService,
    private renderService: IRenderService,
    private db: IDatabase
  ) {}

  canExecute(context: CommandContext): boolean {
    return true; // All players can make picks
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    if (args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('Please specify a team name. Usage: /nfl pick TEAM')
      };
    }

    const teamSlug = args[0].toLowerCase();
    
    // Find team by slug
    const team = await this.db.teams.findBySlug(teamSlug);
    if (!team) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(`Team "${args[0]}" not found. Please use a valid team name like "ravens" or "chiefs".`)
      };
    }

    // Get current year season
    const currentYear = new Date().getFullYear();
    const season = await this.db.seasons.findByYear(currentYear);
    
    if (!season || season.state !== 'active') {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No active season found.')
      };
    }

    // Get current open week
    const currentWeek = await this.weekService.getCurrentWeek(season.season_id);

    if (!currentWeek) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No open week found for picks.')
      };
    }

    const weekId = currentWeek.week_id;

    // Check if player already has a pick this week
    const existingPick = await this.pickService.getPlayerPickForWeek(
      context.player_id,
      weekId
    );

    let pick;
    if (existingPick) {
      // Change pick
      pick = await this.pickService.changePick(existingPick.pick_id, team.team_id);
    } else {
      // Create new pick (validation happens inside)
      pick = await this.pickService.createPick(
        context.player_id,
        weekId,
        team.team_id,
        'manual'
      );
    }

    return {
      type: 'ephemeral',
      content: this.renderService.generatePickConfirmation(
        pick,
        team.name,
        currentWeek.week_number
      )
    };
  }
}
