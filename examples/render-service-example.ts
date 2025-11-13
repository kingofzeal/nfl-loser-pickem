/**
 * Example: Using RenderService
 * 
 * This example demonstrates how to use the RenderService
 * to generate weekly summary images using Satori.
 */

import { RenderService } from '../src/services/RenderService';
import type { StandingWithPlayer, PickWithDetails } from '../src/types';

async function generateWeeklySummary() {
  // 1. Create the service instance
  const renderService = new RenderService();

  // 2. Optional: Initialize with custom font
  // For production, load from R2 or bundle as asset
  // const fontResponse = await fetch('https://fonts.gstatic.com/s/inter/v12/...');
  // const fontData = await fontResponse.arrayBuffer();
  // await renderService.initialize(fontData);

  // 3. Prepare mock data (in production, get from database)
  const standings: StandingWithPlayer[] = [
    {
      standing_id: 1,
      season_id: 1,
      player_id: 1,
      wins: 7,
      losses: 1,
      player: {
        player_id: 1,
        workspace_id: 1,
        platform_user_id: 'user123',
        display_name: 'John Doe',
        is_admin: false,
        joined_week_id: 1,
        created_at: new Date(),
      },
    },
    {
      standing_id: 2,
      season_id: 1,
      player_id: 2,
      wins: 6,
      losses: 2,
      player: {
        player_id: 2,
        workspace_id: 1,
        platform_user_id: 'user456',
        display_name: 'Jane Smith',
        is_admin: false,
        joined_week_id: 1,
        created_at: new Date(),
      },
    },
    {
      standing_id: 3,
      season_id: 1,
      player_id: 3,
      wins: 5,
      losses: 3,
      player: {
        player_id: 3,
        workspace_id: 1,
        platform_user_id: 'user789',
        display_name: 'Bob Wilson',
        is_admin: true,
        joined_week_id: 1,
        created_at: new Date(),
      },
    },
  ];

  const allPicks: Record<number, PickWithDetails[]> = {
    1: [
      {
        pick_id: 1,
        week_id: 8,
        player_id: 1,
        team_id: 1,
        source: 'manual',
        locked_at: new Date(),
        outcome: 'win',
        created_at: new Date(),
        updated_at: new Date(),
        team: {
          team_id: 1,
          slug: 'dal',
          name: 'Dallas Cowboys',
          conference: 'NFC',
          division: 'East',
        },
        week: {
          week_id: 8,
          season_id: 1,
          week_number: 8,
          state: 'finalized',
          open_at: new Date(),
          close_at: new Date(),
        },
      },
    ],
    2: [
      {
        pick_id: 2,
        week_id: 8,
        player_id: 2,
        team_id: 2,
        source: 'manual',
        locked_at: new Date(),
        outcome: 'loss',
        created_at: new Date(),
        updated_at: new Date(),
        team: {
          team_id: 2,
          slug: 'nyg',
          name: 'New York Giants',
          conference: 'NFC',
          division: 'East',
        },
        week: {
          week_id: 8,
          season_id: 1,
          week_number: 8,
          state: 'finalized',
          open_at: new Date(),
          close_at: new Date(),
        },
      },
    ],
    3: [
      {
        pick_id: 3,
        week_id: 8,
        player_id: 3,
        team_id: 3,
        source: 'manual',
        locked_at: null,
        outcome: null,
        created_at: new Date(),
        updated_at: new Date(),
        team: {
          team_id: 3,
          slug: 'ne',
          name: 'New England Patriots',
          conference: 'AFC',
          division: 'East',
        },
        week: {
          week_id: 8,
          season_id: 1,
          week_number: 8,
          state: 'in_progress',
          open_at: new Date(),
          close_at: new Date(),
        },
      },
    ],
  };

  // 4. Generate the image
  console.log('Generating weekly summary image...');
  const imageBuffer = await renderService.generateWeeklySummaryImage(
    2025,
    8,
    standings,
    allPicks
  );

  console.log(`✅ Image generated! Size: ${imageBuffer.length} bytes`);

  // 5. Save to file (for testing)
  // In production, you'd upload to R2 or return in HTTP response
  if (typeof process !== 'undefined') {
    const fs = await import('fs');
    fs.writeFileSync('./example-summary.png', imageBuffer);
    console.log('💾 Saved to example-summary.png');
  }

  return imageBuffer;
}

// Example: Generate other types of messages
async function generateOtherMessages() {
  const renderService = new RenderService();

  // Pick confirmation
  console.log('\n📝 Pick Confirmation:');
  const pickConfirmation = renderService.generatePickConfirmation(
    {
      pick_id: 1,
      week_id: 8,
      player_id: 1,
      team_id: 1,
      source: 'manual',
      locked_at: new Date(),
      outcome: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    'Dallas Cowboys',
    8
  );
  console.log(JSON.stringify(pickConfirmation, null, 2));

  // Help message
  console.log('\n❓ Help Message:');
  const help = renderService.generateHelp();
  console.log(JSON.stringify(help, null, 2));

  // Error message
  console.log('\n❌ Error Message:');
  const error = renderService.generateError('Team already used this season');
  console.log(JSON.stringify(error, null, 2));
}

// Run examples
if (require.main === module) {
  console.log('🏈 RenderService Examples\n');
  console.log('================================\n');

  generateWeeklySummary()
    .then(() => generateOtherMessages())
    .then(() => {
      console.log('\n✅ All examples completed!');
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { generateWeeklySummary, generateOtherMessages };
