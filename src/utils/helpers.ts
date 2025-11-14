import { parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Format a date for display in a specific timezone
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  format: string = 'MMM d, yyyy h:mm a zzz'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, format);
}

/**
 * Convert a date to a specific timezone
 */
export function toTimezone(date: Date | string, timezone: string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, timezone);
}

/**
 * Check if a date has passed
 */
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string): boolean {
  return !isPast(date);
}

/**
 * Format a record as W-L
 */
export function formatRecord(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

/**
 * Parse team name from user input
 */
export function parseTeamName(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize team slug for database lookup
 */
export function normalizeTeamSlug(slug: string): string {
  return slug.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    attempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        const delay = delayMs * Math.pow(backoffMultiplier, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get a random element from an array
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
