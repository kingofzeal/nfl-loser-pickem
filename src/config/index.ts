import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/nfl_pickem',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  },

  // Slack
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
  },

  // Discord
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },

  // Data Source
  dataSource: {
    provider: process.env.DATA_SOURCE || 'espn',
    espnApiBaseUrl: process.env.ESPN_API_BASE_URL || 'https://site.api.espn.com',
    theSportsDbApiKey: process.env.THESPORTSDB_API_KEY || '',
    syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60'),
    syncEnabled: process.env.SYNC_ENABLED === 'true',
    retryAttempts: 3,
    retryDelayMs: 1000,
    timeout: 10000,
  },

  // Timezone
  timezone: {
    default: process.env.DEFAULT_TIMEZONE || 'America/New_York',
  },

  // Scheduler
  scheduler: {
    enabled: process.env.ENABLE_SCHEDULER === 'true',
    weekOpenCron: process.env.WEEK_OPEN_CRON || '0 9 * * 2', // Tuesday 9am
    reminderFridayCron: process.env.REMINDER_FRIDAY_CRON || '0 10 * * 5', // Friday 10am
    reminderSundayCron: process.env.REMINDER_SUNDAY_CRON || '0 9 * * 0', // Sunday 9am
    syncGamesCron: process.env.SYNC_GAMES_CRON || '0 * * * *', // Hourly
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Image Generation
  images: {
    outputPath: process.env.IMAGE_OUTPUT_PATH || './public/images',
    baseUrl: process.env.IMAGE_BASE_URL || 'http://localhost:3000/images',
  },

  // Archive
  archive: {
    enabled: process.env.ARCHIVE_ENABLED === 'true',
    exportPath: process.env.ARCHIVE_EXPORT_PATH || './archives',
    autoArchiveAfterDays: parseInt(process.env.ARCHIVE_AUTO_AFTER_DAYS || '90'),
  },
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  // At least one platform must be configured
  const hasSlack = config.slack.botToken && config.slack.signingSecret;
  const hasDiscord = config.discord.botToken;

  if (!hasSlack && !hasDiscord) {
    errors.push('Either Slack or Discord credentials must be configured');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
