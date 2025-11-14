/**
 * CommandRouter Implementation
 * 
 * Routes incoming commands to appropriate handlers, with:
 * - Command parsing and argument extraction
 * - Permission checking
 * - Error handling and user-friendly error messages
 * - Command registration and dynamic routing
 */

import { ICommandRouter, ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { logger } from '../utils/logger';

export class CommandRouter implements ICommandRouter {
  private handlers: Map<string, ICommandHandler> = new Map();

  /**
   * Register a command handler
   * @param command - The command name (e.g., 'pick', 'my', 'admin')
   * @param handler - The handler instance
   */
  register(command: string, handler: ICommandHandler): void {
    const normalizedCommand = command.toLowerCase();
    this.handlers.set(normalizedCommand, handler);
    logger.debug(`Registered command handler: ${normalizedCommand}`);
  }

  /**
   * Parse a command string into command and arguments
   * 
   * Examples:
   *   "pick ravens" → { command: "pick", args: ["ravens"] }
   *   "admin open-week 8" → { command: "admin", args: ["open-week", "8"] }
   *   "my" → { command: "my", args: [] }
   * 
   * @param input - The raw command string
   * @returns Parsed command object
   */
  parse(input: string): { command: string; args: string[] } {
    // Trim and normalize whitespace
    const trimmed = input.trim().replace(/\s+/g, ' ');
    
    if (!trimmed) {
      return { command: '', args: [] };
    }

    // Split on spaces
    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.debug('Parsed command', { input, command, args });

    return { command, args };
  }

  /**
   * Route a command to its handler
   * 
   * This method:
   * 1. Looks up the appropriate handler
   * 2. Checks permissions
   * 3. Executes the command
   * 4. Catches and handles errors
   * 
   * @param command - The command name
   * @param context - The command execution context
   * @param args - The command arguments
   * @returns The command response
   */
  async route(
    command: string,
    context: CommandContext,
    args: string[]
  ): Promise<CommandResponse> {
    const normalizedCommand = command.toLowerCase();

    logger.info('Routing command', {
      command: normalizedCommand,
      args,
      player_id: context.player_id,
      workspace_id: context.workspace_id,
      is_admin: context.is_admin,
    });

    // Check if command exists
    const handler = this.handlers.get(normalizedCommand);
    
    if (!handler) {
      logger.warn('Unknown command', { command: normalizedCommand });
      return this.createErrorResponse(
        `Unknown command: \`${command}\`\n\n` +
        `Available commands: ${this.getAvailableCommands().join(', ')}\n` +
        `Use \`help\` to see detailed command information.`
      );
    }

    // Check permissions
    if (!handler.canExecute(context)) {
      logger.warn('Permission denied', {
        command: normalizedCommand,
        player_id: context.player_id,
        is_admin: context.is_admin,
      });
      return this.createErrorResponse(
        'You do not have permission to run this command.'
      );
    }

    // Execute command with error handling
    try {
      const response = await handler.execute(context, args);
      
      logger.info('Command executed successfully', {
        command: normalizedCommand,
        player_id: context.player_id,
        response_type: response.type,
      });

      return response;
    } catch (error) {
      logger.error('Command execution failed', {
        command: normalizedCommand,
        args,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        player_id: context.player_id,
      });

      return this.createErrorResponse(
        this.getUserFriendlyErrorMessage(error, command)
      );
    }
  }

  /**
   * Get list of available commands for current context
   * @param context - Optional context to filter by permissions
   * @returns Array of command names
   */
  getAvailableCommands(context?: CommandContext): string[] {
    const commands: string[] = [];

    for (const [command, handler] of this.handlers.entries()) {
      if (!context || handler.canExecute(context)) {
        commands.push(command);
      }
    }

    return commands.sort();
  }

  /**
   * Check if a command is registered
   * @param command - The command name to check
   * @returns True if registered
   */
  hasCommand(command: string): boolean {
    return this.handlers.has(command.toLowerCase());
  }

  /**
   * Get the handler for a command
   * @param command - The command name
   * @returns The handler or undefined
   */
  getHandler(command: string): ICommandHandler | undefined {
    return this.handlers.get(command.toLowerCase());
  }

  /**
   * Create a standardized error response
   * @param message - The error message
   * @returns A command response with error formatting
   */
  private createErrorResponse(message: string): CommandResponse {
    return {
      type: 'ephemeral',
      content: {
        title: '❌ Error',
        description: message,
        color: '#ff0000',
        footer: 'If this error persists, contact an admin.',
      },
    };
  }

  /**
   * Convert technical errors into user-friendly messages
   * @param error - The error object
   * @param command - The command that failed
   * @returns A user-friendly error message
   */
  private getUserFriendlyErrorMessage(error: unknown, command: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Map common errors to user-friendly messages
    const errorMappings: Record<string, string> = {
      'Team already used': 'You have already used this team this season. Pick a different team.',
      'Week not open': 'This week is not open for picks yet.',
      'Pick locked': 'Your pick is locked because the game has started.',
      'No active season': 'There is no active season at the moment.',
      'Player not found': 'Your player account could not be found.',
      'Team not found': 'The specified team could not be found.',
      'Invalid week': 'The specified week number is invalid.',
      'Database error': 'A database error occurred. Please try again later.',
      'Network error': 'A network error occurred. Please try again.',
    };

    // Check for known error patterns
    for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return friendlyMessage;
      }
    }

    // Default fallback for unknown errors
    return `An error occurred while executing \`${command}\`.\n\nError: ${errorMessage}`;
  }
}
