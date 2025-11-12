// Main entry point for the bot
import { config, validateConfig } from './config';
import { logger } from './utils/logger';

async function main() {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // TODO: Initialize database connection
    logger.info('Connecting to database...');

    // TODO: Initialize bot adapters (Slack/Discord)
    if (config.slack.botToken) {
      logger.info('Initializing Slack bot...');
      // await initializeSlackBot();
    }

    if (config.discord.botToken) {
      logger.info('Initializing Discord bot...');
      // await initializeDiscordBot();
    }

    // TODO: Initialize scheduler
    if (config.scheduler.enabled) {
      logger.info('Initializing scheduler...');
      // await initializeScheduler();
    }

    // TODO: Start HTTP server (for webhooks, health checks)
    logger.info(`Starting server on port ${config.server.port}...`);

    logger.info('NFL Loser Pickem Bot started successfully');
  } catch (error) {
    logger.error('Failed to start bot', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  // TODO: Close database connections
  // TODO: Close bot connections
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  // TODO: Close database connections
  // TODO: Close bot connections
  process.exit(0);
});

// Start the bot
main();
