/**
 * Command Router Integration Tests
 * 
 * Tests the command routing, parsing, and permission checking
 */

import { CommandRouter } from '../../src/commands/CommandRouter';
import { ICommandHandler } from '../../src/commands/interfaces/ICommandHandler';
import { CommandContext, CommandResponse } from '../../src/types';

describe('CommandRouter Integration Tests', () => {
  let router: CommandRouter;

  beforeAll(async () => {
    // Setup router with mock handlers
    router = new CommandRouter();
    
    // Register mock handlers for testing
    const mockHandler: ICommandHandler = {
      execute: jest.fn().mockResolvedValue({
        type: 'ephemeral',
        content: { title: 'Success' },
      }),
      canExecute: jest.fn().mockReturnValue(true),
    };
    
    const adminHandler: ICommandHandler = {
      execute: jest.fn().mockResolvedValue({
        type: 'ephemeral',
        content: { title: 'Admin Success' },
      }),
      canExecute: (ctx) => ctx.is_admin,
    };
    
    router.register('pick', mockHandler);
    router.register('my', mockHandler);
    router.register('board', mockHandler);
    router.register('help', mockHandler);
    router.register('admin', adminHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createContext(overrides: Partial<CommandContext> = {}): CommandContext {
    return {
      workspace_id: 1,
      player_id: 1,
      platform: 'discord',
      channel_id: '123',
      is_admin: false,
      ...overrides,
    };
  }

  describe('Command Parsing', () => {
    it('should parse simple commands', () => {
      const result = router.parse('help');
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
    });

    it('should parse commands with arguments', () => {
      const result = router.parse('pick ravens');
      expect(result.command).toBe('pick');
      expect(result.args).toEqual(['ravens']);
    });

    it('should parse admin subcommands', () => {
      const result = router.parse('admin open-week 2');
      expect(result.command).toBe('admin');
      expect(result.args).toEqual(['open-week', '2']);
    });

    it('should normalize whitespace', () => {
      const result = router.parse('  pick   ravens  ');
      expect(result.command).toBe('pick');
      expect(result.args).toEqual(['ravens']);
    });

    it('should handle empty input', () => {
      const result = router.parse('');
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });
  });

  describe('Command Registration', () => {
    it('should have all commands registered', () => {
      expect(router.hasCommand('pick')).toBe(true);
      expect(router.hasCommand('my')).toBe(true);
      expect(router.hasCommand('board')).toBe(true);
      expect(router.hasCommand('help')).toBe(true);
      expect(router.hasCommand('admin')).toBe(true);
    });

    it('should return available commands', () => {
      const commands = router.getAvailableCommands();
      expect(commands).toContain('pick');
      expect(commands).toContain('my');
      expect(commands).toContain('board');
      expect(commands).toContain('help');
      expect(commands).toContain('admin');
    });

    it('should filter commands by permission', () => {
      const regularContext = createContext({
        is_admin: false,
      });

      const commands = router.getAvailableCommands(regularContext);
      expect(commands).toContain('pick');
      expect(commands).toContain('my');
      expect(commands).toContain('board');
      expect(commands).toContain('help');
      expect(commands).not.toContain('admin'); // Should be filtered out
    });
  });

  describe('Permission Checking', () => {
    it('should allow regular users to execute help command', async () => {
      const context = createContext();

      const response = await router.route('help', context, []);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', 'Success');
    });

    it('should deny regular users from executing admin commands', async () => {
      const context = createContext();

      const response = await router.route('admin', context, ['open-week', '2']);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', '❌ Error');
    });

    it('should allow admin users to execute admin commands', async () => {
      const context = createContext({
        is_admin: true,
      });

      const response = await router.route('admin', context, ['sync']);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', 'Admin Success');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown command', async () => {
      const context = createContext();

      const response = await router.route('unknown', context, []);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', '❌ Error');
      if (typeof response.content === 'object' && 'description' in response.content) {
        expect(response.content.description).toContain('Unknown command');
      }
    });

    it('should handle errors from handlers gracefully', async () => {
      const errorHandler: ICommandHandler = {
        execute: jest.fn().mockRejectedValue(new Error('Test error')),
        canExecute: jest.fn().mockReturnValue(true),
      };
      
      router.register('error', errorHandler);
      const context = createContext();

      const response = await router.route('error', context, []);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', '❌ Error');
    });
  });

  describe('Command Execution', () => {
    it('should execute registered command', async () => {
      const context = createContext();

      const response = await router.route('pick', context, ['ravens']);
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', 'Success');
    });

    it('should pass arguments to handler', async () => {
      const context = createContext();
      const handler = router.getHandler('pick');

      await router.route('pick', context, ['arg1', 'arg2']);
      
      expect(handler?.execute).toHaveBeenCalledWith(context, ['arg1', 'arg2']);
    });
  });

});
