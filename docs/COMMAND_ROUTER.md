# Command Router Documentation

## Overview

The `CommandRouter` is responsible for parsing incoming commands, routing them to the appropriate handlers, checking permissions, and handling errors gracefully.

## Architecture

```
User Input → CommandRouter → Permission Check → Handler → Response
                ↓                                   ↓
            Parse                              Error Handler
```

### Flow

1. **Parse**: Extract command and arguments from user input
2. **Lookup**: Find the registered handler for the command
3. **Permission Check**: Verify user has permission to execute
4. **Execute**: Run the handler's execute method
5. **Error Handling**: Catch exceptions and return user-friendly messages

## Usage

### Basic Setup

```typescript
import { CommandRouter } from './commands/CommandRouter';
import { 
  PickCommandHandler,
  MyCommandHandler,
  BoardCommandHandler,
  HelpCommandHandler,
  AdminCommandHandler,
} from './commands';
import { Database } from './database/Database';
import { 
  PickService,
  WeekService,
  GameService,
  StandingsService,
  RenderService,
} from './services';

// Initialize services
const db = new Database(env.DB);
const pickService = new PickService(db);
const weekService = new WeekService(db);
const gameService = new GameService(db, dataProvider);
const standingsService = new StandingsService(db);
const renderService = new RenderService();

// Initialize command handlers
const pickHandler = new PickCommandHandler(pickService, weekService, renderService, db);
const myHandler = new MyCommandHandler(pickService, standingsService, renderService, db);
const boardHandler = new BoardCommandHandler(standingsService, renderService, db);
const helpHandler = new HelpCommandHandler(renderService);
const adminHandler = new AdminCommandHandler(gameService, weekService, pickService, renderService, db);

// Create and configure router
const router = new CommandRouter();
router.register('pick', pickHandler);
router.register('my', myHandler);
router.register('board', boardHandler);
router.register('help', helpHandler);
router.register('admin', adminHandler);
```

### Processing Commands

```typescript
// Example: Discord slash command
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  // Extract command context
  const context: CommandContext = {
    workspace_id: workspaceId,
    player_id: playerId,
    platform: 'discord',
    channel_id: interaction.channelId,
    is_admin: isUserAdmin(interaction.user),
  };

  // Parse command from interaction
  const commandName = interaction.commandName;
  const args = extractArgsFromInteraction(interaction);

  // Route command
  const response = await router.route(commandName, context, args);

  // Send response based on type
  if (response.type === 'ephemeral') {
    await interaction.reply({ 
      embeds: [formatEmbed(response.content)], 
      ephemeral: true 
    });
  } else {
    await interaction.reply({ 
      embeds: [formatEmbed(response.content)] 
    });
  }
});
```

### Parsing Input Strings

```typescript
// Parse a raw command string
const parsed = router.parse('pick ravens');
// Result: { command: 'pick', args: ['ravens'] }

const parsed2 = router.parse('admin open-week 8');
// Result: { command: 'admin', args: ['open-week', '8'] }

const parsed3 = router.parse('my');
// Result: { command: 'my', args: [] }

// Then route it
const response = await router.route(parsed.command, context, parsed.args);
```

## Command Registration

### Register Individual Commands

```typescript
const router = new CommandRouter();

// Register each command
router.register('pick', pickHandler);
router.register('my', myHandler);
router.register('board', boardHandler);
router.register('help', helpHandler);
router.register('admin', adminHandler);
```

### Check if Command Exists

```typescript
if (router.hasCommand('pick')) {
  console.log('Pick command is registered');
}
```

### Get Available Commands

```typescript
// Get all commands
const allCommands = router.getAvailableCommands();
// ['admin', 'board', 'help', 'my', 'pick']

// Get commands available to a specific user
const context: CommandContext = { /* ... */ };
const userCommands = router.getAvailableCommands(context);
// Filters out admin commands if user is not admin
```

## Permission Checking

The router automatically checks permissions before executing commands:

```typescript
// Admin command without admin permission
const context: CommandContext = {
  workspace_id: 1,
  player_id: 1,
  platform: 'discord',
  channel_id: '123',
  is_admin: false, // Not an admin
};

const response = await router.route('admin', context, ['open-week', '8']);
// Response: Error message about insufficient permissions
```

Each handler implements the `canExecute` method:

```typescript
class PickCommandHandler implements ICommandHandler {
  canExecute(context: CommandContext): boolean {
    return true; // All users can pick
  }
}

class AdminCommandHandler implements ICommandHandler {
  canExecute(context: CommandContext): boolean {
    return context.is_admin; // Only admins
  }
}
```

## Error Handling

### Built-in Error Handling

The router catches all errors and converts them to user-friendly messages:

```typescript
try {
  const response = await router.route('pick', context, ['ravens']);
  // Command succeeds
} catch (error) {
  // This won't happen - router catches and handles errors internally
  // Returns an error response instead
}
```

### Error Message Mapping

Common errors are automatically translated:

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| "Team already used" | "You have already used this team this season. Pick a different team." |
| "Week not open" | "This week is not open for picks yet." |
| "Pick locked" | "Your pick is locked because the game has started." |
| "No active season" | "There is no active season at the moment." |

### Custom Error Handling

Handlers can throw errors with specific messages:

```typescript
class PickCommandHandler {
  async execute(context: CommandContext, args: string[]): Promise<CommandResponse> {
    if (args.length === 0) {
      return {
        type: 'ephemeral',
        content: this.renderService.generateError(
          'Please specify a team name. Usage: /nfl pick TEAM'
        )
      };
    }
    
    // ... handle command
  }
}
```

## Command Examples

### Pick Command
```
Input: "pick ravens"
Handler: PickCommandHandler
Permission: All users
Response: Pick confirmation embed
```

### My Command
```
Input: "my"
Handler: MyCommandHandler
Permission: All users
Response: Personal season summary embed
```

### Board Command
```
Input: "board"
Handler: BoardCommandHandler
Permission: All users
Response: Leaderboard embed
```

### Help Command
```
Input: "help"
Handler: HelpCommandHandler
Permission: All users
Response: Help information embed
```

### Admin Commands
```
Input: "admin open-week 8"
Handler: AdminCommandHandler
Permission: Admins only
Response: Success/error message

Input: "admin finalize-week 8"
Handler: AdminCommandHandler
Permission: Admins only
Response: Success/error message

Input: "admin sync"
Handler: AdminCommandHandler
Permission: Admins only
Response: Sync status message
```

## Testing

### Unit Test Example

```typescript
import { CommandRouter } from '../commands/CommandRouter';
import { ICommandHandler } from '../commands/interfaces/ICommandHandler';

describe('CommandRouter', () => {
  let router: CommandRouter;

  beforeEach(() => {
    router = new CommandRouter();
  });

  describe('parse', () => {
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

    it('should parse commands with multiple arguments', () => {
      const result = router.parse('admin open-week 8');
      expect(result.command).toBe('admin');
      expect(result.args).toEqual(['open-week', '8']);
    });

    it('should normalize whitespace', () => {
      const result = router.parse('  pick   ravens  ');
      expect(result.command).toBe('pick');
      expect(result.args).toEqual(['ravens']);
    });
  });

  describe('register', () => {
    it('should register command handlers', () => {
      const mockHandler: ICommandHandler = {
        execute: jest.fn(),
        canExecute: jest.fn().mockReturnValue(true),
      };

      router.register('test', mockHandler);
      expect(router.hasCommand('test')).toBe(true);
    });

    it('should normalize command names', () => {
      const mockHandler: ICommandHandler = {
        execute: jest.fn(),
        canExecute: jest.fn().mockReturnValue(true),
      };

      router.register('TEST', mockHandler);
      expect(router.hasCommand('test')).toBe(true);
    });
  });

  describe('route', () => {
    it('should return error for unknown commands', async () => {
      const context = createMockContext();
      const response = await router.route('unknown', context, []);
      
      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', '❌ Error');
    });

    it('should check permissions', async () => {
      const mockHandler: ICommandHandler = {
        execute: jest.fn(),
        canExecute: jest.fn().mockReturnValue(false),
      };

      router.register('admin', mockHandler);

      const context = createMockContext({ is_admin: false });
      const response = await router.route('admin', context, []);

      expect(response.type).toBe('ephemeral');
      expect(mockHandler.execute).not.toHaveBeenCalled();
    });

    it('should execute command with permission', async () => {
      const mockResponse = {
        type: 'ephemeral',
        content: { title: 'Success' },
      };

      const mockHandler: ICommandHandler = {
        execute: jest.fn().mockResolvedValue(mockResponse),
        canExecute: jest.fn().mockReturnValue(true),
      };

      router.register('test', mockHandler);

      const context = createMockContext();
      const response = await router.route('test', context, ['arg1']);

      expect(mockHandler.execute).toHaveBeenCalledWith(context, ['arg1']);
      expect(response).toEqual(mockResponse);
    });

    it('should handle errors gracefully', async () => {
      const mockHandler: ICommandHandler = {
        execute: jest.fn().mockRejectedValue(new Error('Test error')),
        canExecute: jest.fn().mockReturnValue(true),
      };

      router.register('test', mockHandler);

      const context = createMockContext();
      const response = await router.route('test', context, []);

      expect(response.type).toBe('ephemeral');
      expect(response.content).toHaveProperty('title', '❌ Error');
    });
  });
});

function createMockContext(overrides = {}): CommandContext {
  return {
    workspace_id: 1,
    player_id: 1,
    platform: 'discord',
    channel_id: '123',
    is_admin: false,
    ...overrides,
  };
}
```

## Integration with Platform Adapters

### Discord Integration

```typescript
import { Client, Intents } from 'discord.js';
import { CommandRouter } from './commands/CommandRouter';

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const router = setupCommandRouter(); // Your setup function

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const context = await buildContext(interaction);
  const parsed = router.parse(`${interaction.commandName} ${interaction.options.data.map(o => o.value).join(' ')}`);
  
  const response = await router.route(parsed.command, context, parsed.args);
  
  await interaction.reply({
    embeds: [formatEmbedForDiscord(response.content)],
    ephemeral: response.type === 'ephemeral',
  });
});
```

### Slack Integration

```typescript
import { App } from '@slack/bolt';
import { CommandRouter } from './commands/CommandRouter';

const app = new App({ /* config */ });
const router = setupCommandRouter();

app.command('/nfl', async ({ command, ack, respond }) => {
  await ack();

  const context = await buildContext(command);
  const parsed = router.parse(command.text);
  
  const response = await router.route(parsed.command, context, parsed.args);
  
  await respond({
    text: formatForSlack(response.content),
    response_type: response.type === 'ephemeral' ? 'ephemeral' : 'in_channel',
  });
});
```

## Best Practices

1. **Register all commands at startup**: Don't register commands dynamically during request handling

2. **Use descriptive error messages**: Throw errors with clear, actionable messages

3. **Log command executions**: The router logs all command attempts for debugging

4. **Test permission logic**: Ensure canExecute works correctly for each handler

5. **Handle all errors in handlers**: Return appropriate error responses rather than throwing when possible

6. **Validate arguments early**: Check argument count and types at the start of execute()

7. **Use the RenderService**: Generate consistent error messages through the render service

## Future Enhancements

- [ ] Command aliases (e.g., 'p' for 'pick')
- [ ] Command rate limiting
- [ ] Command usage analytics
- [ ] Dynamic command help generation
- [ ] Command middleware/hooks
- [ ] Autocomplete suggestions
- [ ] Command history/undo

## References

- **Implementation**: `src/commands/CommandRouter.ts`
- **Interface**: `src/commands/interfaces/ICommandHandler.ts`
- **Handlers**: `src/commands/*CommandHandler.ts`
- **Types**: `src/types/index.ts`
