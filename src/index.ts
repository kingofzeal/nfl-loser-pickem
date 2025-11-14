/**
 * NFL Loser Pick'em Bot - Cloudflare Workers Entry Point
 * 
 * Serverless Discord/Slack bot for managing NFL loser pick'em leagues.
 * - fetch() handler for HTTP requests (Discord/Slack webhooks)
 * - scheduled() handler for cron jobs (week locking, standings updates)
 * - Database accessed via D1 bindings (env.DB)
 */

import { Env, getD1Database, testConnection } from './database/connection';
import { Database } from './database/Database';
import { logger } from './utils/logger';

// Services
import {
  AuditService,
  PickService,
  WeekService,
  StandingsService,
  GameService,
  RenderService,
  SchedulerService,
  ESPNDataProvider,
  TheSportsDBProvider,
} from './services';

// Command handlers
import { PickCommandHandler } from './commands/PickCommandHandler';
import { MyCommandHandler } from './commands/MyCommandHandler';
import { BoardCommandHandler } from './commands/BoardCommandHandler';
import { HelpCommandHandler } from './commands/HelpCommandHandler';
import { AdminCommandHandler } from './commands/AdminCommandHandler';
import { CommandContext } from './types';

/**
 * Initialize services with database
 */
function createServices(db: Database, env?: Env) {
  const auditService = new AuditService(db);
  const pickService = new PickService(db, auditService);
  const weekService = new WeekService(db, auditService, pickService);
  const standingsService = new StandingsService(db, auditService);
  // Select data provider based on environment
  const providerName = (env?.DATA_SOURCE || 'espn').toLowerCase();
  const provider = providerName === 'thesportsdb'
    ? new TheSportsDBProvider(env?.THESPORTSDB_API_KEY)
    : new ESPNDataProvider();
  const gameService = new GameService(db, auditService, provider);
  const renderService = new RenderService();
  const schedulerService = new SchedulerService(db, weekService, gameService);

  return {
    db,
    auditService,
    pickService,
    weekService,
    standingsService,
    gameService,
    renderService,
    schedulerService,
  };
}

/**
 * Initialize command handlers with services
 */
function createCommandHandlers(services: ReturnType<typeof createServices>) {
  return {
    pick: new PickCommandHandler(
      services.pickService,
      services.weekService,
      services.renderService,
      services.db
    ),
    my: new MyCommandHandler(
      services.standingsService,
      services.weekService,
      services.renderService,
      services.db
    ),
    board: new BoardCommandHandler(
      services.standingsService,
      services.renderService,
      services.db
    ),
    help: new HelpCommandHandler(services.renderService),
    admin: new AdminCommandHandler(
      services.gameService,
      services.weekService,
      services.pickService,
      services.renderService,
      services.db
    ),
  };
}

/**
 * Workers fetch handler - handles all HTTP requests
 * 
 * This receives:
 * - Discord interaction webhooks
 * - Health check endpoints
 * - Admin API calls (if needed)
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return handleHealthCheck(env);
      }
      
      // Discord interaction webhook
      if (url.pathname === '/discord/interactions' && request.method === 'POST') {
        return handleDiscordInteraction(request, env, ctx);
      }
      
      // Slack event webhook (if using Slack)
      if (url.pathname === '/slack/events' && request.method === 'POST') {
        return handleSlackEvent(request, env, ctx);
      }
      
      // Default 404
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      logger.error('Worker fetch error', { error });
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  /**
   * Scheduled handler - runs on cron triggers
   * 
   * Configured in wrangler.toml:
   * - Tuesday 9 AM UTC: Lock weeks, auto-assign picks
   * - Tuesday 4 AM UTC: Update standings after MNF
   */
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
  const services = createServices(new Database(getD1Database(env)), env);
      
      logger.info('Cron trigger started', {
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime).toISOString(),
      });
      
      // Run all scheduled jobs
      await services.schedulerService.runScheduledJobs();
      
      logger.info('Cron trigger completed successfully');
    } catch (error) {
      logger.error('Cron trigger error', { error });
      // Don't throw - let Workers retry if needed
    }
  },
};

/**
 * Health check endpoint
 * Tests D1 connection and returns status
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  try {
    const db = getD1Database(env);
    const isHealthy = await testConnection(db);
    
    if (isHealthy) {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        status: 'unhealthy',
        error: 'Database connection failed',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: 'error',
      error: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Discord interaction webhook handler
 * 
 * Discord sends interactions to this endpoint instead of using gateway.
 * Must verify signature and respond within 3 seconds.
 */
async function handleDiscordInteraction(
  request: Request, 
  env: Env, 
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Verify Discord signature
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    const body = await request.text();
    
    if (!signature || !timestamp) {
      return new Response('Missing signature headers', { status: 401 });
    }
    
    const isValid = await verifyDiscordSignature(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }
    
    const interaction = JSON.parse(body);
    
    // Handle PING (Discord webhook verification)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Handle application commands
    if (interaction.type === 2) {
      // Acknowledge immediately, then process in background
      ctx.waitUntil(processDiscordCommand(interaction, env));
      
      return new Response(JSON.stringify({
        type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Unknown interaction type', { status: 400 });
  } catch (error) {
    logger.error('Discord interaction error', { error });
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Verify Discord webhook signature using Ed25519
 */
async function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const message = enc.encode(timestamp + body);
    
    // Import public key
    const keyData = hexToBytes(publicKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );
    
    // Verify signature
    const sigBytes = hexToBytes(signature);
    return await crypto.subtle.verify('Ed25519', key, sigBytes, message);
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Process Discord command in background
 * Uses waitUntil to extend execution beyond initial response
 */
async function processDiscordCommand(interaction: any, env: Env): Promise<void> {
  try {
    const db = new Database(getD1Database(env));
    const services = createServices(db, env);
    const handlers = createCommandHandlers(services);
    
    // Extract command name and options
    const commandName = interaction.data.name;
    const subcommand = interaction.data.options?.[0]?.name;
    const args = interaction.data.options?.[0]?.options?.map((opt: any) => opt.value) || [];
    
    // Build command context
    const workspaceId = interaction.guild_id || interaction.channel_id;
    
    // Get or create workspace
    let workspace = await db.workspaces.findByPlatformId('discord', workspaceId);
    if (!workspace) {
      workspace = await db.workspaces.create({
        platform: 'discord',
        platform_workspace_id: workspaceId,
        name: interaction.guild?.name || 'Unknown',
        timezone: 'America/New_York',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
    }
    
    // Get or create player
    const userId = interaction.member?.user?.id || interaction.user?.id;
    let player = await db.players.findByWorkspaceAndPlatformUserId(workspace.workspace_id, userId);
    if (!player) {
      player = await db.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: userId,
        display_name: interaction.member?.user?.username || interaction.user?.username || 'Unknown',
        is_admin: false,
      });
    }
    
    const context: CommandContext = {
      workspace_id: workspace.workspace_id,
      player_id: player.player_id,
      platform: 'discord',
      channel_id: interaction.channel_id,
      is_admin: player.is_admin,
    };
    
    // Route command
    let response;
    try {
      if (commandName === 'nfl') {
        if (subcommand === 'pick') {
          response = await handlers.pick.execute(context, args);
        } else if (subcommand === 'my') {
          response = await handlers.my.execute(context, args);
        } else if (subcommand === 'board') {
          response = await handlers.board.execute(context, args);
        } else if (subcommand === 'help') {
          response = await handlers.help.execute(context, args);
        } else if (subcommand === 'admin') {
          response = await handlers.admin.execute(context, args);
        } else {
          response = {
            type: 'ephemeral' as const,
            content: services.renderService.generateError('Unknown command'),
          };
        }
      } else {
        response = {
          type: 'ephemeral' as const,
          content: services.renderService.generateError('Unknown command'),
        };
      }
    } catch (error: any) {
      logger.error('Command execution error', { error, commandName, subcommand });
      response = {
        type: 'ephemeral' as const,
        content: services.renderService.generateError(error.message || 'An error occurred'),
      };
    }
    
    logger.info('Discord command processed', {
      command: commandName,
      subcommand,
      user: userId,
    });
    
    // Send follow-up message to Discord
    await sendDiscordFollowup(interaction, env, response.content);
  } catch (error) {
    logger.error('Command processing error', { error });
    await sendDiscordFollowup(
      interaction, 
      env, 
      { title: 'Error', description: 'An error occurred processing your command', color: '#ff0000' }
    );
  }
}

/**
 * Send follow-up message to Discord after deferred response
 */
async function sendDiscordFollowup(interaction: any, env: Env, content: any): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
    },
    body: JSON.stringify({ 
      embeds: [content],
    }),
  });
}

/**
 * Handle Slack event webhook (optional - if supporting Slack)
 */
async function handleSlackEvent(
  request: Request, 
  env: Env, 
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as any;
    
    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Process event in background
    ctx.waitUntil(processSlackEvent(body, env));
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('Slack event error', { error });
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Process Slack event in background
 */
async function processSlackEvent(event: any, _env: Env): Promise<void> {
  try {
    // TODO: Route to appropriate handler (Slack support planned)
    logger.info('Slack event processed', { type: event.type });
  } catch (error) {
    logger.error('Slack event processing error', { error });
  }
}

// Legacy standalone cron helpers removed; SchedulerService.runScheduledJobs orchestrates all tasks.
