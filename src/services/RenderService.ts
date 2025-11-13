/**
 * RenderService Implementation
 * 
 * Handles message formatting and rendering:
 * - Generate embeds for Discord/Slack
 * - Format pick confirmations
 * - Create leaderboards
 * - Generate help messages
 * - Create weekly summary images (placeholder for canvas integration)
 */

import { IRenderService } from './interfaces/IRenderService';
import { EmbedMessage, Pick, Standing, StandingWithPlayer, Week, PickWithDetails } from '../types';
import { logger } from '../utils/logger';

export class RenderService implements IRenderService {
  /**
   * Generate pick confirmation message
   */
  generatePickConfirmation(pick: Pick, teamName: string, weekNumber: number): EmbedMessage {
    return {
      title: '✅ Pick Confirmed',
      description: `Your pick for Week ${weekNumber} has been recorded.`,
      fields: [
        { name: 'Team', value: teamName, inline: true },
        { name: 'Week', value: `Week ${weekNumber}`, inline: true },
        { name: 'Source', value: pick.source === 'manual' ? 'Manual' : 'Auto-assigned', inline: true },
      ],
      footer: 'Good luck! 🏈',
      color: '#00ff00', // Green
    };
  }

  /**
   * Generate player's personal season summary
   */
  generateMySummary(
    playerId: number,
    seasonId: number,
    picks: PickWithDetails[],
    standing: Standing
  ): EmbedMessage {
    // Format pick list
    const pickList = picks.map(p => {
      const emoji = p.outcome === 'win' ? '✅' : p.outcome === 'loss' ? '❌' : '⏳';
      const weekInfo = p.week ? `Week ${p.week.week_number}` : 'Week ?';
      const teamInfo = p.team ? p.team.name : 'Unknown';
      return `${emoji} ${weekInfo}: ${teamInfo}`;
    }).join('\n');

    return {
      title: '📊 Your Season Summary',
      description: `Record: ${standing.wins}W - ${standing.losses}L`,
      fields: [
        { 
          name: 'Picks',
          value: pickList || 'No picks yet',
        },
      ],
      footer: `Season ${seasonId}`,
      color: standing.wins > standing.losses ? '#00ff00' : '#ff0000',
    };
  }

  /**
   * Generate standings board
   */
  generateBoard(
    standings: StandingWithPlayer[],
    seasonYear: number,
    weekNumber?: number
  ): EmbedMessage {
    if (standings.length === 0) {
      return {
        title: '🏆 Leaderboard',
        description: 'No standings available yet.',
        color: '#cccccc',
      };
    }

    // Format leaderboard
    const leaderboardLines = standings.map((s, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const name = s.player.display_name;
      const record = `${s.wins}W - ${s.losses}L`;
      return `${medal} **${name}** - ${record}`;
    });

    const title = weekNumber 
      ? `🏆 Leaderboard - Week ${weekNumber}`
      : `🏆 Season ${seasonYear} Leaderboard`;

    return {
      title,
      description: leaderboardLines.join('\n'),
      footer: `Total Players: ${standings.length}`,
      color: '#ffd700', // Gold
    };
  }

  /**
   * Generate help message
   */
  generateHelp(): EmbedMessage {
    return {
      title: '🏈 NFL Loser Pick\'em Bot Help',
      description: 'Welcome to the NFL Loser Pick\'em league! Here\'s how to play:',
      fields: [
        {
          name: '🎯 How to Play',
          value: 'Pick one team each week that you think will **LOSE**. If your team loses, you win that week! But you can only use each team once per season.',
        },
        {
          name: '📝 Commands',
          value: '`/nfl pick <team>` - Make your pick for the current week\n' +
                 '`/nfl my` - View your picks and record\n' +
                 '`/nfl board` - View the leaderboard\n' +
                 '`/nfl help` - Show this help message',
        },
        {
          name: '⚙️ Admin Commands',
          value: '`/nfl admin open-week` - Open a week for picks\n' +
                 '`/nfl admin finalize-week` - Finalize a week after games\n' +
                 '`/nfl admin sync-games` - Sync game data from ESPN',
        },
        {
          name: '📏 Rules',
          value: '• Each team can only be used once per season\n' +
                 '• Picks lock when the team\'s game starts\n' +
                 '• Ties count as losses for the player\n' +
                 '• If you don\'t pick, a team will be auto-assigned',
        },
      ],
      footer: 'Good luck with your picks! 🎲',
      color: '#0099ff', // Blue
    };
  }

  /**
   * Generate week open announcement
   */
  generateWeekOpenAnnouncement(week: Week, seasonYear: number): EmbedMessage {
    return {
      title: `🏈 Week ${week.week_number} is Now Open!`,
      description: `Time to make your picks for Week ${week.week_number} of the ${seasonYear} season.`,
      fields: [
        {
          name: 'How to Pick',
          value: 'Use `/nfl pick <team>` to select the team you think will **LOSE** this week.',
        },
        {
          name: 'Reminder',
          value: 'Remember, you can only use each team once per season. Choose wisely!',
        },
      ],
      footer: 'Picks lock when games start. Don\'t wait too long!',
      color: '#ff6600', // Orange
    };
  }

  /**
   * Generate weekly summary image
   * 
   * Note: This is a placeholder. Real implementation would use canvas or similar
   * to generate an image showing all picks and results in a grid format.
   * For Cloudflare Workers, this might need to be done with an external service
   * or using a lightweight image generation library.
   */
  async generateWeeklySummaryImage(
    seasonYear: number,
    weekNumber: number,
    standings: StandingWithPlayer[],
    allPicks: Record<number, PickWithDetails[]>
  ): Promise<string | Buffer> {
    try {
      logger.debug('Generating weekly summary image', { seasonYear, weekNumber });

      // Placeholder implementation
      // In a real implementation, you would:
      // 1. Create a canvas with appropriate size
      // 2. Draw a grid with player names and their picks
      // 3. Color-code results (green for wins, red for losses)
      // 4. Add team logos if available
      // 5. Return the image as a buffer or upload to R2 and return URL

      logger.warn('generateWeeklySummaryImage not fully implemented - requires canvas integration');

      // Return a placeholder message for now
      return `Weekly summary for Week ${weekNumber}, ${seasonYear} (Image generation not yet implemented)`;
    } catch (error) {
      logger.error('Failed to generate weekly summary image', { error, seasonYear, weekNumber });
      throw new Error(`Failed to generate weekly summary image: ${error}`);
    }
  }

  /**
   * Generate error message
   */
  generateError(message: string): EmbedMessage {
    return {
      title: '❌ Error',
      description: message,
      color: '#ff0000', // Red
      footer: 'If this error persists, contact an admin.',
    };
  }
}
