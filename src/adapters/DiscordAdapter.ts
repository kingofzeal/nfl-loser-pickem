/**
 * DiscordAdapter
 *
 * Translates Discord interactions to the platform-agnostic command interface.
 * Uses Discord Interactions API (webhook-based).
 */
import { ICommandHandler } from '../commands/interfaces/ICommandHandler';
import { logger } from '../utils/logger';
import { CommandContext, CommandResponse, Workspace, Player } from '../types';
import { Database } from '../database/Database';

export class DiscordAdapter {
  private commandHandlers: Record<string, ICommandHandler>;
  private db: Database;

  constructor(commandHandlers: Record<string, ICommandHandler>, db: Database) {
    this.commandHandlers = commandHandlers;
    this.db = db;
  }

  /**
   * Look up or create a player by Discord user ID
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
   * Format CommandResponse for Discord
   */
  private formatDiscordResponse(response: CommandResponse): any {
    // Discord expects an object with 'content' or 'embeds' for webhook response
    if (typeof response.content === 'string') {
      return { content: response.content };
    }
    if ('blocks' in response.content) {
      // BlockMessage: fallback to text
      return { content: response.content.text || JSON.stringify(response.content.blocks) };
    }
    // EmbedMessage: map to Discord embed
    const embed: any = {
      title: response.content.title,
      description: response.content.description,
      color: response.content.color ? parseInt(response.content.color.replace('#', ''), 16) : undefined,
      fields: response.content.fields,
      footer: response.content.footer ? { text: response.content.footer } : undefined,
      thumbnail: response.content.thumbnail ? { url: response.content.thumbnail } : undefined,
      image: response.content.image ? { url: response.content.image } : undefined,
    };
    return { embeds: [embed] };
  }

  /**
   * Handle Discord interaction (slash command)
   */
  async handleInteraction(interaction: any): Promise<any> {
    try {
      const { data, member, guild_id, channel_id } = interaction;
      // Find workspace by Discord guild ID
      const workspace = await this.db.workspaces.findByPlatformId('discord', guild_id);
      if (!workspace) {
        return { type: 4, data: { content: 'Workspace not registered. Please contact an admin.' } };
      }
      // Find or create player by Discord user ID
      const displayName = member?.nick || member?.user?.username || 'Unknown';
      const player = await this.getOrCreatePlayer(workspace, member.user.id, displayName);
      // Route to handler (for demo, always 'pick'; you may want to parse data.options)
      const handler = this.commandHandlers['pick'];
      if (!handler) {
        return { type: 4, data: { content: 'Unknown command.' } };
      }
      const context: CommandContext = {
        workspace_id: workspace.workspace_id,
        player_id: player.player_id,
        platform: 'discord',
        channel_id: channel_id,
        is_admin: !!player.is_admin
      };
      const args = data.options?.map((opt: any) => opt.value) || [];
      const result = await handler.execute(context, args);
      return { type: 4, data: this.formatDiscordResponse(result) };
    } catch (error) {
      logger.error('Discord interaction failed', { error });
      return { type: 4, data: { content: 'Error processing command.' } };
    }
  }
}
