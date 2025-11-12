import { CommandContext, CommandResponse } from '../types';

/**
 * Base command handler interface
 */
export interface ICommandHandler {
  /**
   * Execute the command
   */
  execute(context: CommandContext, args: string[]): Promise<CommandResponse>;

  /**
   * Check if user has permission to run this command
   */
  canExecute(context: CommandContext): boolean;
}

/**
 * Command registry for routing commands to handlers
 */
export interface ICommandRouter {
  /**
   * Register a command handler
   */
  register(command: string, handler: ICommandHandler): void;

  /**
   * Route a command to its handler
   */
  route(command: string, context: CommandContext, args: string[]): Promise<CommandResponse>;

  /**
   * Parse a command string into command and args
   */
  parse(input: string): { command: string; args: string[] };
}

/**
 * Available commands
 */
export enum Command {
  PICK = 'pick',
  MY = 'my',
  BOARD = 'board',
  HELP = 'help',
  ADMIN = 'admin'
}

/**
 * Admin subcommands
 */
export enum AdminCommand {
  SEED_SEASON = 'seed-season',
  OPEN_WEEK = 'open-week',
  FINALIZE_WEEK = 'finalize-week',
  SET_GAME = 'set-game',
  RESET_PICK = 'reset-pick',
  SYNC = 'sync',
  CONFIG = 'config'
}
