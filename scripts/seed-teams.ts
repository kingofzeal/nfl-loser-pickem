#!/usr/bin/env tsx
/**
 * Seed script to populate the teams table with all 32 NFL teams
 * Run with: npm run seed:teams
 */

import { getPool, closePool } from '../src/database/connection';
import { logger } from '../src/utils/logger';

const teams = [
  // AFC East
  { slug: 'bills', name: 'Buffalo Bills', conference: 'AFC', division: 'East' },
  { slug: 'dolphins', name: 'Miami Dolphins', conference: 'AFC', division: 'East' },
  { slug: 'patriots', name: 'New England Patriots', conference: 'AFC', division: 'East' },
  { slug: 'jets', name: 'New York Jets', conference: 'AFC', division: 'East' },

  // AFC North
  { slug: 'ravens', name: 'Baltimore Ravens', conference: 'AFC', division: 'North' },
  { slug: 'bengals', name: 'Cincinnati Bengals', conference: 'AFC', division: 'North' },
  { slug: 'browns', name: 'Cleveland Browns', conference: 'AFC', division: 'North' },
  { slug: 'steelers', name: 'Pittsburgh Steelers', conference: 'AFC', division: 'North' },

  // AFC South
  { slug: 'texans', name: 'Houston Texans', conference: 'AFC', division: 'South' },
  { slug: 'colts', name: 'Indianapolis Colts', conference: 'AFC', division: 'South' },
  { slug: 'jaguars', name: 'Jacksonville Jaguars', conference: 'AFC', division: 'South' },
  { slug: 'titans', name: 'Tennessee Titans', conference: 'AFC', division: 'South' },

  // AFC West
  { slug: 'broncos', name: 'Denver Broncos', conference: 'AFC', division: 'West' },
  { slug: 'chiefs', name: 'Kansas City Chiefs', conference: 'AFC', division: 'West' },
  { slug: 'raiders', name: 'Las Vegas Raiders', conference: 'AFC', division: 'West' },
  { slug: 'chargers', name: 'Los Angeles Chargers', conference: 'AFC', division: 'West' },

  // NFC East
  { slug: 'cowboys', name: 'Dallas Cowboys', conference: 'NFC', division: 'East' },
  { slug: 'giants', name: 'New York Giants', conference: 'NFC', division: 'East' },
  { slug: 'eagles', name: 'Philadelphia Eagles', conference: 'NFC', division: 'East' },
  { slug: 'commanders', name: 'Washington Commanders', conference: 'NFC', division: 'East' },

  // NFC North
  { slug: 'bears', name: 'Chicago Bears', conference: 'NFC', division: 'North' },
  { slug: 'lions', name: 'Detroit Lions', conference: 'NFC', division: 'North' },
  { slug: 'packers', name: 'Green Bay Packers', conference: 'NFC', division: 'North' },
  { slug: 'vikings', name: 'Minnesota Vikings', conference: 'NFC', division: 'North' },

  // NFC South
  { slug: 'falcons', name: 'Atlanta Falcons', conference: 'NFC', division: 'South' },
  { slug: 'panthers', name: 'Carolina Panthers', conference: 'NFC', division: 'South' },
  { slug: 'saints', name: 'New Orleans Saints', conference: 'NFC', division: 'South' },
  { slug: 'buccaneers', name: 'Tampa Bay Buccaneers', conference: 'NFC', division: 'South' },

  // NFC West
  { slug: 'cardinals', name: 'Arizona Cardinals', conference: 'NFC', division: 'West' },
  { slug: 'rams', name: 'Los Angeles Rams', conference: 'NFC', division: 'West' },
  { slug: '49ers', name: 'San Francisco 49ers', conference: 'NFC', division: 'West' },
  { slug: 'seahawks', name: 'Seattle Seahawks', conference: 'NFC', division: 'West' },
];

async function seedTeams() {
  const pool = getPool();

  try {
    logger.info('Starting team seeding...');

    // Check if teams already exist
    const existingCount = await pool.query('SELECT COUNT(*) as count FROM teams');
    const count = parseInt(existingCount.rows[0].count);

    if (count > 0) {
      logger.info(`Teams table already has ${count} teams. Skipping seed.`);
      return;
    }

    // Insert all teams
    for (const team of teams) {
      await pool.query(
        `INSERT INTO teams (slug, name, conference, division)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [team.slug, team.name, team.conference, team.division]
      );
    }

    logger.info(`Successfully seeded ${teams.length} NFL teams`);

    // Verify
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM teams');
    logger.info(`Total teams in database: ${finalCount.rows[0].count}`);
  } catch (error) {
    logger.error('Error seeding teams', { error });
    throw error;
  } finally {
    await closePool();
  }
}

// Run the seeding
seedTeams()
  .then(() => {
    logger.info('Team seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Team seeding failed', { error });
    process.exit(1);
  });
