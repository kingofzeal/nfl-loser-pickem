#!/usr/bin/env node

/**
 * Discord Slash Command Registration Script
 * 
 * This script registers the /nfl command and all its subcommands with Discord.
 * Run this once after creating your Discord application.
 * 
 * Usage:
 *   1. Update DISCORD_TOKEN and APPLICATION_ID below
 *   2. Run: node scripts/register-discord-commands.js
 * 
 * Or set environment variables:
 *   DISCORD_TOKEN=xxx APPLICATION_ID=yyy node scripts/register-discord-commands.js
 */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const APPLICATION_ID = process.env.APPLICATION_ID || '';

if (!DISCORD_TOKEN || !APPLICATION_ID) {
  console.error('❌ Error: DISCORD_TOKEN and APPLICATION_ID must be set');
  console.error('');
  console.error('Set them as environment variables:');
  console.error('  DISCORD_TOKEN=your_token APPLICATION_ID=your_id node scripts/register-discord-commands.js');
  console.error('');
  console.error('Or edit this file and add them directly (not recommended for production)');
  process.exit(1);
}

const commands = [
  {
    name: 'nfl',
    description: 'NFL Loser Pick\'em league commands',
    options: [
      {
        name: 'pick',
        description: 'Make your pick for the current week',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'team',
            description: 'Team to pick (e.g., ravens, chiefs, 49ers)',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'my',
        description: 'View your picks and season record',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'board',
        description: 'View the season leaderboard',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'week',
            description: 'Optional: Week number to view (default: current season)',
            type: 4, // INTEGER
            required: false,
          },
        ],
      },
      {
        name: 'help',
        description: 'Show help and game rules',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'admin',
        description: 'Admin commands (admin only)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'action',
            description: 'Admin action to perform',
            type: 3, // STRING
            required: true,
            choices: [
              { name: 'Seed Season', value: 'seed-season' },
              { name: 'Open Week', value: 'open-week' },
              { name: 'Finalize Week', value: 'finalize-week' },
              { name: 'Set Game', value: 'set-game' },
              { name: 'Reset Pick', value: 'reset-pick' },
              { name: 'Sync Games', value: 'sync' },
              { name: 'Config', value: 'config' },
            ],
          },
          {
            name: 'week',
            description: 'Week number (required for most actions)',
            type: 4, // INTEGER
            required: false,
          },
          {
            name: 'year',
            description: 'Year (for seed-season)',
            type: 4, // INTEGER
            required: false,
          },
        ],
      },
    ],
  },
];

async function registerCommands() {
  console.log('🚀 Registering Discord slash commands...');
  console.log('');
  console.log(`Application ID: ${APPLICATION_ID}`);
  console.log(`Commands to register: ${commands.length}`);
  console.log('');

  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register commands');
      console.error('Status:', response.status, response.statusText);
      console.error('Error:', error);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✅ Commands registered successfully!');
    console.log('');
    console.log('Registered commands:');
    result.forEach((cmd) => {
      console.log(`  - /${cmd.name}`);
      if (cmd.options) {
        cmd.options.forEach((opt) => {
          console.log(`    - ${opt.name}: ${opt.description}`);
        });
      }
    });
    console.log('');
    console.log('🎉 Done! Commands should appear in Discord within a few seconds.');
    console.log('');
    console.log('Note: Global commands can take up to 1 hour to propagate to all servers.');
    console.log('For instant updates, use guild-specific commands instead (see Discord docs).');
    
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
}

// Optional: Register commands for a specific guild (instant updates)
async function registerGuildCommands(guildId) {
  console.log(`🚀 Registering commands for guild ${guildId}...`);
  console.log('(Guild commands update instantly, unlike global commands)');
  console.log('');

  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${guildId}/commands`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register guild commands');
      console.error('Status:', response.status, response.statusText);
      console.error('Error:', error);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✅ Guild commands registered successfully!');
    console.log('Commands are now available in your server immediately.');
    
  } catch (error) {
    console.error('❌ Error registering guild commands:', error);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const guildIdArg = args.find(arg => arg.startsWith('--guild='));

if (guildIdArg) {
  const guildId = guildIdArg.split('=')[1];
  registerGuildCommands(guildId);
} else {
  registerCommands();
}
