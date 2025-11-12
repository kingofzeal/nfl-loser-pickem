import { ICommandHandler } from './interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../types';
import { IRenderService } from '../services/interfaces/IRenderService';

/**
 * Handler for /nfl help command
 */
export class HelpCommandHandler implements ICommandHandler {
  constructor(private renderService: IRenderService) {}

  canExecute(context: CommandContext): boolean {
    return true; // Everyone can view help
  }

  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    return {
      type: 'ephemeral',
      content: this.renderService.generateHelp()
    };
  }
}
