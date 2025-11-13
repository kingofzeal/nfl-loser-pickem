/**
 * SlackAdapter
 *
 * Translates Slack events and commands to the platform-agnostic command interface.
 * Uses the Bolt framework for event handling.
 */
import { App, ExpressReceiver } from '@slack/bolt';
import { ICommandHandler } from '../commands/interfaces/ICommandHandler';
import { logger } from '../utils/logger';
import { CommandContext, CommandResponse, BlockMessage, EmbedMessage, Workspace, Player } from '../types';
import { Database } from '../database/Database';

export class SlackAdapter {
  private app: App;
  private commandHandlers: Record<string, ICommandHandler>;
  private db: Database;

  constructor(
    commandHandlers: Record<string, ICommandHandler>,
    db: Database,
    signingSecret: string,
    botToken: string
  ) {
    this.commandHandlers = commandHandlers;
    this.db = db;
    const receiver = new ExpressReceiver({ signingSecret });
    this.app = new App({ token: botToken, receiver });
    this.registerListeners();
  }

  /**
   * Look up or create a player by Slack user ID
   */
  private async getOrCreatePlayer(workspace: Workspace, platformUserId: string, displayName: string): Promise<Player> {
    let player = await this.db.players.findByWorkspaceAndPlatformUserId(workspace.workspace_id, platformUserId);
    if (!player) {
      player = await this.db.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: platformUserId,
        display_name: displayName,
        is_admin: false,
        joined_week_id: null
      });
    }
    return player;
  }

  /**
   * Format CommandResponse for Slack
   */
  private formatSlackResponse(response: CommandResponse): any {
    if (response.type === 'ephemeral') {
      return { response_type: 'ephemeral', text: this.formatContent(response.content) };
    }
    if (response.type === 'public') {
      return { response_type: 'in_channel', text: this.formatContent(response.content) };
    }
    if (response.type === 'dm') {
      return { text: this.formatContent(response.content) };
    }
    return { text: this.formatContent(response.content) };
  }

  /**
   * Format content for Slack (blocks or plain text)
   */
  private formatContent(content: string | EmbedMessage | BlockMessage): string {
    if (typeof content === 'string') return content;
    if ('blocks' in content) {
      // BlockMessage: return fallback text or JSON string
      return content.text || JSON.stringify(content.blocks);
    }
    // EmbedMessage: format as text
    let text = `*${content.title}*\n`;
    if (content.description) text += `${content.description}\n`;
    if (content.fields) {
      for (const field of content.fields) {
        text += `*${field.name}:* ${field.value}\n`;
      }
    }
    if (content.footer) text += `_${content.footer}_\n`;
    return text;
  }

  /**
   * Register Slack event listeners and command handlers
   */
  private registerListeners() {
    // Main: /nfl command
    this.app.command('/nfl', async ({ command, ack, respond }) => {
      await ack();
      try {
        // Find workspace by Slack team ID
        const workspace = await this.db.workspaces.findByPlatformId('slack', command.team_id);
        if (!workspace) {
          await respond('Workspace not registered. Please contact an admin.');
          return;
        }
        // Find or create player by Slack user ID
        const player = await this.getOrCreatePlayer(workspace, command.user_id, command.user_name);
        // Route to handler (for demo, always 'pick'; you may want to parse command.text)
        const handler = this.commandHandlers['pick'];
        if (!handler) {
          await respond('Unknown command.');
          return;
        }
        const context: CommandContext = {
          workspace_id: workspace.workspace_id,
          player_id: player.player_id,
          platform: 'slack',
          channel_id: command.channel_id,
          is_admin: !!player.is_admin
        };
        const args = command.text ? command.text.split(' ') : [];
        const result = await handler.execute(context, args);
        await respond(this.formatSlackResponse(result));
      } catch (error) {
        logger.error('Slack /nfl command failed', { error });
        await respond('Error processing command.');
      }
    });
    // ...register other commands similarly
  }

  /**
   * Start the Slack app (for local development)
   */
  async start(port: number = 3000) {
    await this.app.start(port);
    logger.info(`Slack app running on port ${port}`);
  }
}
