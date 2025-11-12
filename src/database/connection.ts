import { Pool, PoolConfig } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const poolConfig: PoolConfig = {
      connectionString: config.database.url,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
    });

    // Log successful connection
    pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    logger.info('Database connection pool created', {
      maxConnections: config.database.poolSize,
    });
  }

  return pool;
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    logger.info('Database connection test successful', {
      serverTime: result.rows[0].current_time,
    });
    
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error });
    return false;
  }
}

/**
 * Close the database connection pool
 * Should be called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  
  try {
    logger.debug('Executing query', { query: text, params });
    const result = await client.query(text, params);
    return result.rows as T[];
  } catch (error) {
    logger.error('Query execution failed', { query: text, params, error });
    throw error;
  } finally {
    client.release();
  }
}
