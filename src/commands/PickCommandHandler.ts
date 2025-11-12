import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IPickService } from '../services/interfaces/IPickService';
import { IRenderService } from '../services/interfaces/IRenderService';
import { IDatabase } from '../services/interfaces/IDatabase';

/**
 * Handler for /nfl pick TEAM command
 */
export class PickCommandHandler implements ICommandHandler {
  constructor(
    private pickService: IPickService,
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

    // Get current week for active season
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

    const currentWeek = await this.db.query<any>(
      'SELECT * FROM weeks WHERE season_id = $1 AND state IN ($2, $3) ORDER BY week_number ASC LIMIT 1',
      [activeSeason[0].season_id, 'open', 'in_progress']
    );

    if (currentWeek.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError('No open week found for picks.')
      };
    }

    const weekId = currentWeek[0].week_id;

    // Validate pick
    const validation = await this.pickService.validatePick(
      context.player_id,
      weekId,
      team.team_id
    );

    if (!validation.valid) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(validation.error!)
      };
    }

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
      // Create new pick
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
        currentWeek[0].week_number
      )
    };
  }
}
