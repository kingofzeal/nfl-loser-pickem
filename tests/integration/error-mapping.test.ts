/**
 * Error Mapping Tests for CommandRouter
 */
import { CommandRouter } from '../../src/commands/CommandRouter';
import { ICommandHandler } from '../../src/commands/interfaces/ICommandHandler';
import { CommandContext } from '../../src/types';

class FailingHandler implements ICommandHandler {
  canExecute() { return true; }
  async execute(): Promise<any> { throw new Error('Team already used'); }
}

describe('CommandRouter error mapping', () => {
  it('maps technical error to friendly message', async () => {
    const router = new CommandRouter();
    router.register('fail', new FailingHandler());
    const ctx: CommandContext = { workspace_id: 1, player_id: 1, platform: 'discord', channel_id: 'C', is_admin: false };
    const res = await router.route('fail', ctx, []);
    expect(typeof res.content).toBe('object');
    if (typeof res.content === 'object' && 'description' in res.content) {
      expect((res.content as any).description).toContain('Pick a different team');
    }
  });
});
