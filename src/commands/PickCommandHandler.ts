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

  canExecute(_context: CommandContext): boolean {
    return true; // All players can make picks
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
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

    // If no team specified, show eligible teams
    if (args.length === 0) {
      // Get games for current week to find which teams are playing
      const games = await this.db.games.findByWeek(weekId);
      const teamsPlayingThisWeek = new Set<number>();
      
      for (const game of games) {
        teamsPlayingThisWeek.add(game.home_team_id);
        teamsPlayingThisWeek.add(game.away_team_id);
      }

      if (teamsPlayingThisWeek.size === 0) {
        return {
          type: 'ephemeral',
          content: this.renderService.generateError(`No games found for Week ${currentWeek.week_number}. Please sync game data first.`)
        };
      }

      // Get all teams player has already picked this season
      const allPicks = await this.db.picks.findByPlayer(context.player_id);
      const seasonPicks = allPicks.filter(p => {
        // Filter to current season picks only - we need to check via week
        return true; // TODO: Would need to join with weeks to filter by season
      });
      const usedTeamIds = new Set(seasonPicks.map(p => p.team_id));

      // Get all teams
      const allTeams = await this.db.teams.findAll();
      
      // Filter to teams playing this week AND not already used
      const eligibleTeams = allTeams
        .filter(t => teamsPlayingThisWeek.has(t.team_id) && !usedTeamIds.has(t.team_id))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (eligibleTeams.length === 0) {
        const allPlaying = allTeams.filter(t => teamsPlayingThisWeek.has(t.team_id));
        if (allPlaying.length === usedTeamIds.size) {
          return {
            type: 'ephemeral',
            content: this.renderService.generateError('You have already used all teams playing in Week ${currentWeek.week_number}!')
          };
        }
        return {
          type: 'ephemeral',
          content: this.renderService.generateError('No eligible teams available for this week.')
        };
      }

      // Return helpful message with eligible teams
      const teamList = eligibleTeams
        .map(t => `\`${t.slug}\` (${t.name})`)
        .join('\n');

      return {
        type: 'ephemeral',
        content: {
          title: '🏈 Choose Your Team to Lose',
          description: `Please specify a team for Week ${currentWeek.week_number}. Usage: \`/nfl pick <team>\`\n\n*Eligible Teams (playing this week, not yet used):*\n${teamList}`,
          footer: 'Example: /nfl pick ravens',
          color: '#0099ff'
        }
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
