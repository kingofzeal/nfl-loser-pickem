#!/usr/bin/env tsx
/**
 * Seed script to create a test season with weeks
 * Run with: npm run seed:season -- --year 2025
 */

import { Database } from '../src/database/Database';
import { closePool } from '../src/database/connection';
import { logger } from '../src/utils/logger';

async function seedSeason(year: number = 2025) {
  const db = new Database();

  try {
    logger.info(`Creating season ${year}...`);

    // Check if season exists
    const existing = await db.seasons.findByYear(year);
    if (existing) {
      logger.info(`Season ${year} already exists. Skipping.`);
      return;
    }

    // Create season
    const season = await db.seasons.create({
      year,
      weeks_count: 18,
      state: 'upcoming',
    });

    logger.info(`Created season ${year} with ID ${season.season_id}`);

    // Create 18 weeks
    const startDate = new Date(year, 8, 1); // September 1st

    for (let weekNum = 1; weekNum <= 18; weekNum++) {
      // Each week starts on Tuesday and ends on Monday
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      await db.weeks.create({
        season_id: season.season_id,
        week_number: weekNum,
        state: 'scheduled',
        open_at: weekStart,
        close_at: weekEnd,
      });

      logger.info(`Created week ${weekNum}`);
    }

    logger.info(`Successfully created season ${year} with 18 weeks`);

    // Summary
    const weeks = await db.weeks.findBySeason(season.season_id);
    logger.info(`Total weeks created: ${weeks.length}`);
  } catch (error) {
    logger.error('Error seeding season', { error });
    throw error;
  } finally {
    await closePool();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const yearIndex = args.indexOf('--year');
const year = yearIndex !== -1 ? parseInt(args[yearIndex + 1]) : 2025;

// Run the seeding
seedSeason(year)
  .then(() => {
    logger.info('Season seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Season seeding failed', { error });
    process.exit(1);
  });
