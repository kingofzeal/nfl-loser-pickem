#!/usr/bin/env node

/**
 * Slack Workspace Setup Script
 * 
 * Helps set up Slack workspace entry in the database after deployment.
 * This creates the workspace record that links your Slack team to the bot.
 * 
 * Usage:
 *   node scripts/setup-slack-workspace.js
 * 
 * Or with environment variables:
 *   TEAM_ID=T123ABC WORKSPACE_NAME="My League" node scripts/setup-slack-workspace.js
 * 
 * Requirements:
 * - Worker already deployed
 * - Database already created and migrated
 * - Wrangler CLI installed and authenticated
 */

const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🎯 Slack Workspace Setup\n');
  console.log('This script creates a workspace entry in your database for Slack integration.\n');

  // Get Slack Team ID
  let teamId = process.env.TEAM_ID;
  if (!teamId) {
    console.log('📋 Find your Slack Team ID:');
    console.log('   1. Go to https://api.slack.com/apps');
    console.log('   2. Select your app');
    console.log('   3. Go to "Basic Information"');
    console.log('   4. Look for "Workspace" or use the team ID from your OAuth token\n');
    teamId = await question('Enter your Slack Team ID (e.g., T0123ABCDEF): ');
  }

  if (!teamId || teamId.trim() === '') {
    console.error('❌ Error: Team ID is required');
    process.exit(1);
  }

  // Get workspace name
  let workspaceName = process.env.WORKSPACE_NAME;
  if (!workspaceName) {
    workspaceName = await question('Enter a name for your league (e.g., "My NFL League"): ');
  }

  if (!workspaceName || workspaceName.trim() === '') {
    console.error('❌ Error: Workspace name is required');
    process.exit(1);
  }

  // Get worker URL
  let workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    console.log('\n📍 Your Worker URL was shown after deployment.');
    console.log('   It looks like: https://nfl-loser-pickem.YOUR-SUBDOMAIN.workers.dev\n');
    workerUrl = await question('Enter your Worker URL: ');
  }

  if (!workerUrl || workerUrl.trim() === '') {
    console.error('❌ Error: Worker URL is required');
    process.exit(1);
  }

  // Clean up URLs
  workerUrl = workerUrl.trim().replace(/\/$/, ''); // Remove trailing slash
  const webhookUrl = `${workerUrl}/slack/commands`;

  // Get database name
  let dbName = process.env.DB_NAME || 'nfl-loser-pickem-db';
  const useCustomDb = await question(`\nUse database "${dbName}"? (Y/n): `);
  if (useCustomDb.toLowerCase() === 'n') {
    dbName = await question('Enter database name: ');
  }

  console.log('\n📝 Summary:');
  console.log(`   Team ID: ${teamId}`);
  console.log(`   Workspace Name: ${workspaceName}`);
  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log(`   Database: ${dbName}`);

  const confirm = await question('\nProceed with creating workspace? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    console.log('❌ Cancelled');
    process.exit(0);
  }

  // Create SQL command
  const sql = `INSERT INTO workspaces (name, platform, platform_workspace_id) VALUES ('${workspaceName}', 'slack', '${teamId}')`;

  console.log('\n🚀 Creating workspace entry...');

  try {
    const command = `wrangler d1 execute ${dbName} --remote --command="${sql}"`;
    console.log(`\nExecuting: ${command}\n`);
    
    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);

    console.log('✅ Workspace created successfully!\n');
    console.log('🎯 Next steps:');
    console.log('   1. Go to https://api.slack.com/apps → Your App');
    console.log('   2. Update Slash Command Request URL to:');
    console.log(`      ${webhookUrl}`);
    console.log('   3. Test in Slack: /nfl help');
    console.log('   4. Make yourself admin:');
    console.log(`      wrangler d1 execute ${dbName} --remote --command="SELECT * FROM players"`);
    console.log(`      wrangler d1 execute ${dbName} --remote --command="UPDATE players SET is_admin = 1 WHERE player_id = YOUR_ID"`);

  } catch (error) {
    console.error('❌ Error creating workspace:', error.message);
    console.log('\n💡 Tip: You can create it manually:');
    console.log(`   wrangler d1 execute ${dbName} --remote --command="${sql}"`);
    process.exit(1);
  }

  rl.close();
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
