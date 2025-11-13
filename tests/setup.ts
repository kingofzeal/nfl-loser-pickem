/**
 * Global test setup for D1/SQLite testing
 * 
 * Uses better-sqlite3 for local testing instead of PostgreSQL.
 * This provides a lightweight, in-memory database for tests.
 */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Global test database instance
let testDb: Database.Database | null = null;

/**
 * Get or create the test database
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    // Create in-memory SQLite database
    testDb = new Database(':memory:', { verbose: console.log });
    
    // Run migrations
    const migrationsDir = join(__dirname, '..', 'migrations');
    const migrationFiles = readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        
        // Split on semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const stmt of statements) {
          try {
            testDb.exec(stmt);
          } catch (error) {
            console.error(`Error executing statement from ${file}:`, error);
            throw error;
          }
        }
      }
    }
    
    console.log('Test database initialized with migrations');
  }
  
  return testDb;
}

/**
 * Reset the test database (clear all data but keep schema)
 */
export function resetTestDb(): void {
  if (!testDb) return;
  
  // Delete all data from tables (in reverse order to handle foreign keys)
  const tables = [
    'audit_log',
    'picks',
    'standings',
    'players',
    'workspaces',
    'games',
    'weeks',
    'seasons',
    'teams',
  ];
  
  for (const table of tables) {
    testDb.exec(`DELETE FROM ${table}`);
  }
}

/**
 * Close the test database
 */
export function closeTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

beforeAll(() => {
  // Setup before all tests
  process.env.NODE_ENV = 'test';
  
  // Initialize test database
  getTestDb();
});

afterEach(() => {
  // Reset data between tests to ensure isolation
  resetTestDb();
});

afterAll(() => {
  // Cleanup after all tests
  closeTestDb();
});

