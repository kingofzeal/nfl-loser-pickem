import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IRenderService } from '../services/interfaces/IRenderService';

/**
 * Handler for /nfl help command
 */
export class HelpCommandHandler implements ICommandHandler {
  constructor(private renderService: IRenderService) {}

  canExecute(_context: CommandContext): boolean {
    return true; // Everyone can view help
  }

  async execute(_context: CommandContext, _args: string[]): Promise<CommandResponse> {
    return {
      type: 'ephemeral',
      content: this.renderService.generateHelp()
    };
  }
}
