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
      
      // Slack slash commands (if using Slack)
      if (url.pathname === '/slack/commands' && request.method === 'POST') {
        return handleSlackCommand(request, env, ctx);
      }
      
      // Slack interactivity (modals, buttons, etc.)
      if (url.pathname === '/slack/interactivity' && request.method === 'POST') {
        return handleSlackInteractivity(request, env, ctx);
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
 * Convert Discord-style markdown to Slack mrkdwn format
 */
function convertToSlackMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')  // Discord bold (**text**) to Slack bold (*text*)
    .replace(/`([^`]+)`/g, '`$1`');      // Keep backticks as-is
}

/**
 * Handle Slack pick modal - show dropdown of eligible teams
 */
async function handleSlackPickModal(
  triggerId: string,
  context: CommandContext,
  database: Database,
  env: Env
): Promise<Response> {
  try {
    // Get current season and week
    const currentYear = new Date().getFullYear();
    const season = await database.seasons.findByYear(currentYear);
    
    if (!season || season.state !== 'active') {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ No active season found.'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const weeks = await database.weeks.findBySeason(season.season_id);
    const currentWeek = weeks.find(w => w.state === 'open' || w.state === 'in_progress');

    if (!currentWeek) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ No open week found for picks.'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get games and eligible teams
    const games = await database.games.findByWeek(currentWeek.week_id);
    const teamsPlayingThisWeek = new Set<number>();
    
    for (const game of games) {
      teamsPlayingThisWeek.add(game.home_team_id);
      teamsPlayingThisWeek.add(game.away_team_id);
    }

    if (teamsPlayingThisWeek.size === 0) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: `❌ No games found for Week ${currentWeek.week_number}. Please sync game data first.`
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for existing pick this week
    const existingPick = await database.picks.findByWeekAndPlayer(currentWeek.week_id, context.player_id);
    
    // Get player's used teams (excluding current week if changing pick)
    const allPicks = await database.picks.findByPlayer(context.player_id);
    const usedTeamIds = new Set(
      allPicks
        .filter(p => p.week_id !== currentWeek.week_id)  // Exclude current week
        .map(p => p.team_id)
    );

    // Get eligible teams
    const allTeams = await database.teams.findAll();
    const eligibleTeams = allTeams
      .filter(t => teamsPlayingThisWeek.has(t.team_id) && !usedTeamIds.has(t.team_id))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (eligibleTeams.length === 0) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: `❌ No eligible teams available for Week ${currentWeek.week_number}.`
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Find the existing pick's team if there is one
    let initialOption = undefined;
    if (existingPick) {
      const existingTeam = allTeams.find(t => t.team_id === existingPick.team_id);
      if (existingTeam) {
        initialOption = {
          text: {
            type: 'plain_text',
            text: `${existingTeam.name} (${existingTeam.slug})`
          },
          value: existingTeam.slug
        };
      }
    }

    // Build Slack modal with dropdown
    const modalTitle = existingPick ? `Change Week ${currentWeek.week_number} Pick` : `Week ${currentWeek.week_number} Pick`;
    const modalText = existingPick 
      ? `*Change your team to LOSE for Week ${currentWeek.week_number}:*\n\nYou currently have a pick. Select a different team to change it.\n\nRemember: You can only use each team once per season!`
      : `*Choose your team to LOSE for Week ${currentWeek.week_number}:*\n\nRemember: You can only use each team once per season!`;
    
    const selectElement: any = {
      type: 'static_select',
      action_id: 'team_selection',
      placeholder: {
        type: 'plain_text',
        text: 'Choose a team...'
      },
      options: eligibleTeams.map(team => ({
        text: {
          type: 'plain_text',
          text: `${team.name} (${team.slug})`
        },
        value: team.slug
      }))
    };
    
    // Pre-select existing pick if available
    if (initialOption) {
      selectElement.initial_option = initialOption;
    }
    
    const modal = {
      type: 'modal',
      callback_id: 'pick_team_modal',
      title: {
        type: 'plain_text',
        text: modalTitle
      },
      submit: {
        type: 'plain_text',
        text: existingPick ? 'Change Pick' : 'Submit Pick'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: modalText
          }
        },
        {
          type: 'input',
          block_id: 'team_select',
          label: {
            type: 'plain_text',
            text: 'Select Team'
          },
          element: selectElement
        }
      ],
      private_metadata: JSON.stringify({
        workspace_id: context.workspace_id,
        player_id: context.player_id,
        week_id: currentWeek.week_id,
        week_number: currentWeek.week_number
      })
    };

    // Open modal using Slack API
    const slackToken = env.SLACK_BOT_TOKEN;
    const modalResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view: modal
      })
    });

    const modalResult = await modalResponse.json() as any;
    
    if (!modalResult.ok) {
      logger.error('Failed to open Slack modal', { error: modalResult.error });
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: `❌ Failed to open pick dialog: ${modalResult.error}`
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return empty 200 response (modal was opened)
    return new Response('', { status: 200 });
    
  } catch (error) {
    logger.error('Slack pick modal error', { error });
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle Slack slash command
 */
async function handleSlackCommand(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  try {
    // Verify Slack signature
    const signature = request.headers.get('X-Slack-Signature');
    const timestamp = request.headers.get('X-Slack-Request-Timestamp');
    
    if (!signature || !timestamp) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Parse the form data from Slack
    const formData = await request.formData();
    const command = formData.get('command') as string;
    const text = formData.get('text') as string || '';
    const userId = formData.get('user_id') as string;
    const teamId = formData.get('team_id') as string;
    const userName = formData.get('user_name') as string;
    
    logger.info('Slack command received', { command, text, userId, teamId });
    
    // Initialize database and services
    const database = new Database(getD1Database(env));
    const services = createServices(database, env);
    const handlers = createCommandHandlers(services);
    
    // Find workspace by Slack team ID
    const workspace = await database.workspaces.findByPlatformId('slack', teamId);
    if (!workspace) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Workspace not registered. Please contact an admin to set up this workspace.'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Find or create player
    let player = await database.players.findByWorkspaceAndPlatformUserId(workspace.workspace_id, userId);
    if (!player) {
      player = await database.players.create({
        workspace_id: workspace.workspace_id,
        platform_user_id: userId,
        display_name: userName,
        is_admin: false,
        joined_week_id: null,
      });
      logger.info('New Slack player created', { player_id: player.player_id, display_name: userName });
    }
    
    // Parse command and args
    const args = text.trim().split(/\s+/).filter(arg => arg.length > 0);
    const subcommand = args[0]?.toLowerCase() || 'help';
    const commandArgs = args.slice(1);
    
    // Create command context
    const context: CommandContext = {
      workspace_id: workspace.workspace_id,
      player_id: player.player_id,
      platform: 'slack',
      channel_id: formData.get('channel_id') as string,
      is_admin: !!player.is_admin,
    };

    // Special handling for /nfl pick without args in Slack - show modal with dropdown
    if (subcommand === 'pick' && commandArgs.length === 0) {
      const triggerId = formData.get('trigger_id') as string;
      return await handleSlackPickModal(triggerId, context, database, env);
    }
    
    // Route to appropriate handler
    let handler;
    switch (subcommand) {
      case 'pick':
        handler = handlers.pick;
        break;
      case 'my':
        handler = handlers.my;
        break;
      case 'board':
      case 'standings':
        handler = handlers.board;
        break;
      case 'admin':
        handler = handlers.admin;
        break;
      case 'help':
      default:
        handler = handlers.help;
        break;
    }
    
    // Check if this is a long-running admin sync command
    const isLongRunningCommand = subcommand === 'admin' && commandArgs[0]?.toLowerCase() === 'sync';
    
    if (isLongRunningCommand) {
      // Respond immediately and process in background
      const responseUrl = formData.get('response_url') as string;
      
      // Send immediate acknowledgment
      const immediateResponse = new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '⏳ Syncing games from ESPN... This may take a moment.'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Process command in background using waitUntil
      _ctx.waitUntil(
        (async () => {
          try {
            const result = await handler.execute(context, commandArgs);
            
            // Format response
            let responseText = '';
            if (typeof result.content === 'string') {
              responseText = convertToSlackMarkdown(result.content);
            } else if ('title' in result.content) {
              responseText = `*${result.content.title}*\n`;
              if (result.content.description) {
                responseText += `${convertToSlackMarkdown(result.content.description)}\n`;
              }
              if (result.content.fields) {
                for (const field of result.content.fields) {
                  responseText += `\n*${field.name}:*\n${convertToSlackMarkdown(field.value)}\n`;
                }
              }
              if (result.content.footer) {
                responseText += `\n_${convertToSlackMarkdown(result.content.footer)}_`;
              }
            }
            
            // Send follow-up message to response_url
            if (responseUrl) {
              await fetch(responseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  response_type: result.type === 'public' ? 'in_channel' : 'ephemeral',
                  text: responseText,
                  replace_original: true,
                }),
              });
            }
          } catch (error) {
            logger.error('Background command execution error', { error });
            if (responseUrl) {
              await fetch(responseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  response_type: 'ephemeral',
                  text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  replace_original: true,
                }),
              });
            }
          }
        })()
      );
      
      return immediateResponse;
    }
    
    // Execute command synchronously for fast commands
    const result = await handler.execute(context, commandArgs);
    
    // Format response for Slack
    let responseText = '';
    if (typeof result.content === 'string') {
      responseText = convertToSlackMarkdown(result.content);
    } else if ('title' in result.content) {
      // EmbedMessage - convert to Slack format
      responseText = `*${result.content.title}*\n`;
      if (result.content.description) {
        responseText += `${convertToSlackMarkdown(result.content.description)}\n`;
      }
      if (result.content.fields) {
        for (const field of result.content.fields) {
          responseText += `\n*${field.name}:*\n${convertToSlackMarkdown(field.value)}\n`;
        }
      }
      if (result.content.footer) {
        responseText += `\n_${convertToSlackMarkdown(result.content.footer)}_`;
      }
    }
    
    return new Response(JSON.stringify({
      response_type: result.type === 'public' ? 'in_channel' : 'ephemeral',
      text: responseText,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    logger.error('Slack command error', { error });
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }), {
      status: 200, // Slack requires 200 even for errors
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle Slack interactivity (modal submissions, button clicks, etc.)
 */
async function handleSlackInteractivity(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  try {
    const formData = await request.formData();
    const payloadStr = formData.get('payload') as string;
    
    if (!payloadStr) {
      logger.error('No payload in Slack interactivity request');
      return new Response('Bad Request', { status: 400 });
    }
    
    const payload = JSON.parse(payloadStr);
    
    logger.info('Slack interactivity received', { type: payload.type, callback_id: payload.view?.callback_id });
    
    // Handle modal submission
    if (payload.type === 'view_submission' && payload.view.callback_id === 'pick_team_modal') {
      try {
        const metadata = JSON.parse(payload.view.private_metadata);
        const selectedOption = payload.view.state.values.team_select?.team_selection?.selected_option;
        
        if (!selectedOption) {
          logger.error('No team selected in modal');
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              team_select: 'Please select a team'
            }
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const teamSlug = selectedOption.value;
        
        logger.info('Processing pick modal submission', { teamSlug, metadata });
        
        // Initialize database and services
        const database = new Database(getD1Database(env));
        const services = createServices(database, env);
        
        // Find team
        const team = await database.teams.findBySlug(teamSlug);
        if (!team) {
          logger.error('Team not found', { teamSlug });
          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              team_select: 'Invalid team selection'
            }
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Check if player already has a pick this week
        const existingPick = await services.pickService.getPlayerPickForWeek(
          metadata.player_id,
          metadata.week_id
        );
        
        let pick;
        if (existingPick) {
          // Change pick
          logger.info('Changing existing pick', { pickId: existingPick.pick_id, newTeam: team.team_id });
          pick = await services.pickService.changePick(existingPick.pick_id, team.team_id);
        } else {
          // Create new pick
          logger.info('Creating new pick', { playerId: metadata.player_id, weekId: metadata.week_id, team: team.team_id });
          pick = await services.pickService.createPick(
            metadata.player_id,
            metadata.week_id,
            team.team_id,
            'manual'
          );
        }
        
        logger.info('Pick saved successfully', { pickId: pick.pick_id });
        
        // Send confirmation message to user
        const userId = payload.user.id;
        const confirmationMessage = existingPick 
          ? `✅ Pick changed! You're now picking *${team.name}* to LOSE in Week ${metadata.week_number}.`
          : `✅ Pick confirmed! You've picked *${team.name}* to LOSE in Week ${metadata.week_number}.`;
        
        // Send DM to user with confirmation (in background)
        _ctx.waitUntil(
          (async () => {
            try {
              const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  channel: userId,
                  text: confirmationMessage
                })
              });
              const result = await response.json() as any;
              if (!result.ok) {
                logger.error('Failed to send pick confirmation', { error: result.error });
              }
            } catch (error) {
              logger.error('Failed to send pick confirmation', { error });
            }
          })()
        );
        
        // Success - close modal without confirmation dialog
        return new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        logger.error('Error processing pick modal', { error, errorMessage: error instanceof Error ? error.message : 'Unknown' });
        // Show error in modal
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: {
            team_select: error instanceof Error ? error.message : 'Failed to save pick'
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Default response for other interaction types
    logger.info('Unhandled Slack interaction type', { type: payload.type });
    return new Response('', { status: 200 });
    
  } catch (error) {
    logger.error('Slack interactivity error', { error, errorMessage: error instanceof Error ? error.message : 'Unknown' });
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 200, // Slack requires 200 even for errors
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
