/**
 * RenderService Implementation
 * 
 * Uses Satori to convert HTML/JSX to SVG, which is then converted to PNG.
 * This is ideal for Cloudflare Workers as it doesn't require native dependencies like node-canvas.
 * 
 * Features:
 * - Cloudflare Workers compatible (no native bindings)
 * - JSX/React-style template rendering
 * - SVG output (PNG conversion disabled for Workers compatibility)
 * - Lightweight and fast
 * - Dynamic image sizing based on data
 * 
 * Note: PNG conversion via @resvg/resvg-js is commented out as it requires native bindings
 * that don't work in Cloudflare Workers. SVG output is fully functional.
 */

import satori, { SatoriOptions } from 'satori';
// PNG conversion disabled for Cloudflare Workers (native bindings not supported)
// import { Resvg } from '@resvg/resvg-js';
import { IRenderService } from './interfaces/IRenderService';
import { 
  EmbedMessage, 
  Pick, 
  Standing, 
  StandingWithPlayer, 
  Week, 
  PickWithDetails 
} from '../types';
import { logger } from '../utils/logger';

export class RenderService implements IRenderService {
  private font: ArrayBuffer | null = null;

  /**
   * Initialize the service with font data
   * For Cloudflare Workers, you'll need to load the font as a binary asset
   * 
   * @param fontData - ArrayBuffer of a TrueType/OpenType font file
   */
  async initialize(fontData?: ArrayBuffer): Promise<void> {
    if (fontData) {
      this.font = fontData;
      logger.info('RenderService initialized with custom font');
    } else {
      // In production, you'd load this from R2 or bundle it as an asset
      logger.warn('No font provided - Satori may fall back to system fonts');
    }
  }

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
  generateHelp(isAdmin: boolean = false): EmbedMessage {
    const fields: { name: string; value: string }[] = [
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
    ];

    // Only show admin commands to admins
    if (isAdmin) {
      fields.push({
        name: '⚙️ Admin Commands',
        value: '`/nfl admin open-week <week>` - Open a week for picks\n' +
               '`/nfl admin finalize-week <week>` - Finalize a week after games\n' +
               '`/nfl admin sync` - Sync current week from ESPN\n' +
               '`/nfl admin sync <week>` - Sync specific week from ESPN\n' +
               '`/nfl admin sync <start>-<end>` - Sync week range (e.g., 1-11)\n' +
               '`/nfl admin sync all` - Sync all active weeks from ESPN\n' +
               '`/nfl admin reset-pick <week> <player>` - Delete a player\'s pick',
      });
    }

    fields.push({
      name: '📏 Rules',
      value: '• Each team can only be used once per season\n' +
             '• Picks lock when the team\'s game starts\n' +
             '• Ties count as losses for the player\n' +
             '• If you don\'t pick, a team will be auto-assigned',
    });

    return {
      title: '🏈 NFL Loser Pick\'em Bot Help',
      description: 'Welcome to the NFL Loser Pick\'em league! Here\'s how to play:',
      fields,
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
   * Generate weekly summary image using Satori
   * 
   * This creates a visual grid showing:
   * - All players down the left column
   * - Their picks and results for the week
   * - Color-coded outcomes (green = win, red = loss, gray = pending)
   * 
   * @returns Buffer of PNG image
   */
  async generateWeeklySummaryImage(
    seasonYear: number,
    weekNumber: number,
    standings: StandingWithPlayer[],
    allPicks: Record<number, PickWithDetails[]>
  ): Promise<Buffer> {
    try {
      logger.debug('Generating weekly summary image with Satori', { seasonYear, weekNumber });

      // Build the JSX structure for the image
      const jsx = this.buildWeeklySummaryJSX(seasonYear, weekNumber, standings, allPicks);

      // Configure Satori options
      const options: SatoriOptions = {
        width: 1200,
        height: Math.max(600, 100 + standings.length * 60), // Dynamic height based on player count
        fonts: this.font ? [{
          name: 'Inter',
          data: this.font,
          weight: 400,
          style: 'normal',
        }] : [],
      };

      // Generate SVG
      const svg = await satori(jsx, options);

      // PNG conversion disabled for Cloudflare Workers (native bindings not supported)
      // Return SVG as buffer for now - in the future, this could use a Workers-compatible
      // image conversion service or Cloudflare Images API
      
      // TODO Phase 11: Implement Workers-compatible PNG conversion
      // Options: Cloudflare Images API, external service, or client-side conversion
      
      const svgBuffer = Buffer.from(svg, 'utf-8');

      logger.info('Successfully generated weekly summary image (SVG)', { 
        seasonYear, 
        weekNumber,
        sizeBytes: svgBuffer.length 
      });

      return svgBuffer;

      /* Original PNG conversion code (requires native bindings):
      const resvg = new Resvg(svg, {
        fitTo: {
          mode: 'width',
          value: 1200,
        },
      });

      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      logger.info('Successfully generated weekly summary image', { 
        seasonYear, 
        weekNumber,
        sizeBytes: pngBuffer.length 
      });

      return pngBuffer;
      */
    } catch (error) {
      logger.error('Failed to generate weekly summary image', { error, seasonYear, weekNumber });
      throw new Error(`Failed to generate weekly summary image: ${error}`);
    }
  }

  /**
   * Build JSX structure for weekly summary
   * Satori uses React-style JSX syntax
   */
  private buildWeeklySummaryJSX(
    seasonYear: number,
    weekNumber: number,
    standings: StandingWithPlayer[],
    allPicks: Record<number, PickWithDetails[]>
  ): any {
    return {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          padding: 40,
          fontFamily: 'Inter, sans-serif',
        },
        children: [
          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                marginBottom: 30,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 48,
                      fontWeight: 700,
                      marginBottom: 10,
                    },
                    children: `🏈 Week ${weekNumber} - ${seasonYear}`,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 24,
                      color: '#888888',
                    },
                    children: 'NFL Loser Pick\'em Summary',
                  },
                },
              ],
            },
          },
          // Table header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                borderBottom: '2px solid #333333',
                paddingBottom: 15,
                marginBottom: 15,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { width: 60, fontSize: 20, fontWeight: 600 },
                    children: 'Rank',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { flex: 1, fontSize: 20, fontWeight: 600 },
                    children: 'Player',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { width: 200, fontSize: 20, fontWeight: 600 },
                    children: 'Pick',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { width: 100, fontSize: 20, fontWeight: 600 },
                    children: 'Result',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { width: 120, fontSize: 20, fontWeight: 600, textAlign: 'right' },
                    children: 'Record',
                  },
                },
              ],
            },
          },
          // Player rows
          ...standings.map((standing, index) => {
            const playerPicks = allPicks[standing.player_id] || [];
            const weekPick = playerPicks.find(p => p.week?.week_number === weekNumber);
            
            const rank = index + 1;
            const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            const pickText = weekPick?.team?.name || 'No Pick';
            const outcome = weekPick?.outcome;
            const outcomeDisplay = outcome === 'win' ? '✅ Win' : outcome === 'loss' ? '❌ Loss' : '⏳ Pending';
            const outcomeColor = outcome === 'win' ? '#00ff00' : outcome === 'loss' ? '#ff0000' : '#888888';

            return {
              type: 'div',
              key: standing.player_id,
              props: {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px 0',
                  borderBottom: '1px solid #2a2a2a',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { width: 60, fontSize: 24 },
                      children: rankDisplay,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { flex: 1, fontSize: 22, fontWeight: 500 },
                      children: standing.player.display_name,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { width: 200, fontSize: 20 },
                      children: pickText,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { width: 100, fontSize: 20, color: outcomeColor },
                      children: outcomeDisplay,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { 
                        width: 120, 
                        fontSize: 20, 
                        textAlign: 'right',
                        color: standing.wins > standing.losses ? '#00ff00' : '#ff6666',
                      },
                      children: `${standing.wins}-${standing.losses}`,
                    },
                  },
                ],
              },
            };
          }),
        ],
      },
    };
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
