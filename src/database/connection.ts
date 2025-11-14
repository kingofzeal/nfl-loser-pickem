/**
 * Database Connection (Cloudflare D1)
 * 
 * D1 bindings are provided by the Cloudflare Workers runtime.
 * No connection pooling needed - D1 handles connections automatically.
 * 
 * Usage:
 *   const db = getD1Database(env);
 *   const result = await db.prepare('SELECT * FROM teams').all();
 */

import { logger } from '../utils/logger';

/**
 * Cloudflare Workers Environment bindings
 * Extend this interface as you add more bindings (KV, R2, etc.)
 */
export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  BACKUPS?: R2Bucket;
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  ESPN_API_KEY?: string;
  DATA_SOURCE?: string;
  THESPORTSDB_API_KEY?: string;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

/**
 * Get the D1 database instance from Workers environment
 * 
 * @param env - Workers environment bindings
 * @returns D1Database instance
 */
export function getD1Database(env: Env): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding not found. Check wrangler.toml configuration.');
  }
  
  return env.DB;
}

/**
 * Test the database connection
 * 
 * @param db - D1Database instance
 * @returns true if connection is successful
 */
export async function testConnection(db: D1Database): Promise<boolean> {
  try {
    const result = await db.prepare("SELECT datetime('now') as current_time").first<{ current_time: string }>();
    
    logger.info('Database connection test successful', {
      serverTime: result?.current_time,
    });
    
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
}

/**
 * Helper to execute a simple query (no parameters)
 * Returns all rows
 * 
 * @param db - D1Database instance
 * @param sql - SQL query string
 * @returns Array of result rows
 */
export async function queryAll<T = any>(db: D1Database, sql: string): Promise<T[]> {
  try {
    logger.debug('Executing D1 query', { query: sql });
    const result = await db.prepare(sql).all<T>();
    
    if (!result.success) {
      throw new Error('D1 query failed');
    }
    
    return result.results;
  } catch (error) {
    logger.error('D1 query execution failed', { query: sql, error });
    throw error;
  }
}

/**
 * Helper to execute a query with parameters
 * Returns all rows
 * 
 * @param db - D1Database instance
 * @param sql - SQL query string with ? placeholders
 * @param params - Array of parameter values
 * @returns Array of result rows
 */
export async function query<T = any>(db: D1Database, sql: string, params: any[]): Promise<T[]> {
  try {
    logger.debug('Executing D1 query', { query: sql, params });
    const result = await db.prepare(sql).bind(...params).all<T>();
    
    if (!result.success) {
      throw new Error('D1 query failed');
    }
    
    return result.results;
  } catch (error) {
    logger.error('D1 query execution failed', { query: sql, params, error });
    throw error;
  }
}

/**
 * Helper to execute a query and return first row only
 * 
 * @param db - D1Database instance
 * @param sql - SQL query string with ? placeholders
 * @param params - Array of parameter values
 * @returns First result row or null
 */
export async function queryFirst<T = any>(db: D1Database, sql: string, params: any[]): Promise<T | null> {
  try {
    logger.debug('Executing D1 query (first)', { query: sql, params });
    const result = await db.prepare(sql).bind(...params).first<T>();
    return result;
  } catch (error) {
    logger.error('D1 query execution failed', { query: sql, params, error });
    throw error;
  }
}

/**
 * Helper to execute a mutation query (INSERT, UPDATE, DELETE)
 * Returns metadata about the operation
 * 
 * @param db - D1Database instance
 * @param sql - SQL query string with ? placeholders
 * @param params - Array of parameter values
 * @returns D1 result metadata
 */
export async function execute(db: D1Database, sql: string, params: any[]): Promise<D1Result> {
  try {
    logger.debug('Executing D1 mutation', { query: sql, params });
    const result = await db.prepare(sql).bind(...params).run();
    
    if (!result.success) {
      throw new Error('D1 mutation failed');
    }
    
    return result;
  } catch (error) {
    logger.error('D1 mutation execution failed', { query: sql, params, error });
    throw error;
  }
}

/**
 * Execute multiple statements in a batch (transaction-like)
 * All statements succeed or all fail together
 * 
 * Note: D1 batch operations are not true transactions with rollback support.
 * They provide atomicity but have some limitations.
 * 
 * @param db - D1Database instance
 * @param statements - Array of prepared D1PreparedStatement objects
 * @returns Array of results for each statement
 */
export async function executeBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  try {
    logger.debug('Executing D1 batch', { statementCount: statements.length });
    const results = await db.batch(statements);
    
    // Check if any statement failed
    const failed = results.find((r: D1Result) => !r.success);
    if (failed) {
      throw new Error('D1 batch execution failed');
    }
    
    return results;
  } catch (error) {
    logger.error('D1 batch execution failed', { error });
    throw error;
  }
}
