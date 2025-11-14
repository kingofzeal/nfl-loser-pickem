/**
 * Example: Setting up and using the CommandRouter
 * 
 * This example demonstrates how to:
 * - Initialize all command handlers
 * - Register commands with the router
 * - Parse and route commands
 * - Handle responses
 */

import { CommandRouter } from '../src/commands/CommandRouter';
import {
  PickCommandHandler,
  MyCommandHandler,
  BoardCommandHandler,
  HelpCommandHandler,
  AdminCommandHandler,
} from '../src/commands';
import { CommandContext } from '../src/types';

/**
 * Setup function - initialize all handlers and register them
 */
function setupCommandRouter(services: any, db: any): CommandRouter {
  const { pickService, weekService, gameService, standingsService, renderService } = services;

  // Initialize command handlers
  const pickHandler = new PickCommandHandler(
    pickService,
    weekService,
    renderService,
    db
  );

  const myHandler = new MyCommandHandler(
    pickService,
    standingsService,
    renderService,
    db
  );

  const boardHandler = new BoardCommandHandler(
    standingsService,
    renderService,
    db
  );

  const helpHandler = new HelpCommandHandler(renderService);

  const adminHandler = new AdminCommandHandler(
    gameService,
    weekService,
    pickService,
    renderService,
    db
  );

  // Create router and register commands
  const router = new CommandRouter();
  router.register('pick', pickHandler);
  router.register('my', myHandler);
  router.register('board', boardHandler);
  router.register('help', helpHandler);
  router.register('admin', adminHandler);

  console.log('✅ Command router initialized');
  console.log('📋 Registered commands:', router.getAvailableCommands().join(', '));

  return router;
}

/**
 * Example: Parse and route a command
 */
async function handleCommand(
  router: CommandRouter,
  input: string,
  context: CommandContext
) {
  console.log(`\n🎮 Processing command: "${input}"`);
  console.log(`👤 User: ${context.player_id} (admin: ${context.is_admin})`);

  // Parse the command
  const parsed = router.parse(input);
  console.log(`📝 Parsed: command="${parsed.command}", args=[${parsed.args.join(', ')}]`);

  // Route to handler
  const response = await router.route(parsed.command, context, parsed.args);

  console.log(`📤 Response type: ${response.type}`);
  if (typeof response.content === 'string') {
    console.log(`📄 Content: ${response.content}`);
  } else if ('title' in response.content) {
    console.log(`📄 Title: ${response.content.title}`);
    if (response.content.description) {
      console.log(`📄 Description: ${response.content.description}`);
    }
  }

  return response;
}

/**
 * Example: Test various commands
 */
async function runExamples() {
  // Mock services (in real app, these would be actual service instances)
  const mockServices = {
    pickService: {} as any,
    weekService: {} as any,
    gameService: {} as any,
    standingsService: {} as any,
    renderService: {
      generateError: (msg: string) => ({ title: '❌ Error', description: msg }),
      generateHelp: () => ({ title: '🏈 Help', description: 'Commands...' }),
    } as any,
  };

  const mockDb = {} as any;

  // Setup router
  const router = setupCommandRouter(mockServices, mockDb);

  // Example contexts
  const regularUser: CommandContext = {
    workspace_id: 1,
    player_id: 1,
    platform: 'discord',
    channel_id: 'channel-123',
    is_admin: false,
  };

  const adminUser: CommandContext = {
    workspace_id: 1,
    player_id: 2,
    platform: 'discord',
    channel_id: 'channel-123',
    is_admin: true,
  };

  console.log('🚀 Running command examples...\n');
  console.log('='.repeat(60));

  // Example 1: Help command
  await handleCommand(router, 'help', regularUser);

  // Example 2: Pick command
  await handleCommand(router, 'pick ravens', regularUser);

  // Example 3: My command
  await handleCommand(router, 'my', regularUser);

  // Example 4: Board command
  await handleCommand(router, 'board', regularUser);

  // Example 5: Admin command by regular user (should fail)
  await handleCommand(router, 'admin open-week 8', regularUser);

  // Example 6: Admin command by admin user (should succeed)
  await handleCommand(router, 'admin open-week 8', adminUser);

  // Example 7: Admin sync command
  await handleCommand(router, 'admin sync', adminUser);

  // Example 8: Unknown command
  await handleCommand(router, 'invalid', regularUser);

  // Example 9: Command with multiple args
  await handleCommand(router, 'admin open-week 8', adminUser);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All examples completed!');
}

/**
 * Example: Parsing different command formats
 */
function demonstrateParsing() {
  const router = new CommandRouter();

  console.log('\n📝 Command Parsing Examples:\n');
  console.log('='.repeat(60));

  const examples = [
    'help',
    'pick ravens',
    'pick chiefs',
    'my',
    'board',
    'admin open-week 8',
    'admin finalize-week 8',
    'admin sync',
    'admin sync 8',
    '  pick   ravens  ', // Extra whitespace
    'PICK RAVENS', // Uppercase
  ];

  for (const example of examples) {
    const parsed = router.parse(example);
    console.log(`Input: "${example}"`);
    console.log(`  → command: "${parsed.command}"`);
    console.log(`  → args: [${parsed.args.map(a => `"${a}"`).join(', ')}]`);
    console.log();
  }

  console.log('='.repeat(60));
}

/**
 * Example: Checking available commands
 */
function demonstrateAvailableCommands() {
  const mockServices = {
    renderService: {
      generateHelp: () => ({ title: 'Help' }),
    },
  } as any;

  const router = setupCommandRouter(mockServices, {} as any);

  console.log('\n📋 Available Commands:\n');
  console.log('='.repeat(60));

  // All commands
  const allCommands = router.getAvailableCommands();
  console.log('All registered commands:', allCommands.join(', '));

  // Commands for regular user
  const regularContext: CommandContext = {
    workspace_id: 1,
    player_id: 1,
    platform: 'discord',
    channel_id: '123',
    is_admin: false,
  };
  const regularCommands = router.getAvailableCommands(regularContext);
  console.log('Regular user commands:', regularCommands.join(', '));

  // Commands for admin
  const adminContext: CommandContext = {
    workspace_id: 1,
    player_id: 2,
    platform: 'discord',
    channel_id: '123',
    is_admin: true,
  };
  const adminCommands = router.getAvailableCommands(adminContext);
  console.log('Admin user commands:', adminCommands.join(', '));

  console.log('='.repeat(60));
}

/**
 * Example: Error handling
 */
async function demonstrateErrorHandling() {
  const mockServices = {
    pickService: {
      createPick: async () => {
        throw new Error('Team already used');
      },
    },
    renderService: {
      generateError: (msg: string) => ({ title: '❌ Error', description: msg }),
    },
  } as any;

  const router = setupCommandRouter(mockServices, {} as any);

  console.log('\n⚠️ Error Handling Examples:\n');
  console.log('='.repeat(60));

  const context: CommandContext = {
    workspace_id: 1,
    player_id: 1,
    platform: 'discord',
    channel_id: '123',
    is_admin: false,
  };

  // Trigger an error
  const response = await router.route('pick', context, ['ravens']);
  
  console.log('Command resulted in error (as expected):');
  if (typeof response.content === 'object' && 'description' in response.content) {
    console.log(`  Error: ${response.content.description}`);
  }

  console.log('='.repeat(60));
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('🏈 CommandRouter Examples\n');
  
  demonstrateParsing();
  demonstrateAvailableCommands();
  
  console.log('\n💡 Note: Full command execution examples require database connection');
  console.log('💡 Run with actual services initialized to see full functionality\n');
}

export {
  setupCommandRouter,
  handleCommand,
  runExamples,
  demonstrateParsing,
  demonstrateAvailableCommands,
  demonstrateErrorHandling,
};
