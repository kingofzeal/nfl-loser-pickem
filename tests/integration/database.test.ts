import { Pool } from 'pg';
import { config } from '../../src/config';

describe('Database Integration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.database.url });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should connect to database', async () => {
    const result = await pool.query('SELECT 1 as result');
    expect(result.rows[0].result).toBe(1);
  });

  it('should have teams table populated', async () => {
    const result = await pool.query('SELECT COUNT(*) as count FROM teams');
    expect(parseInt(result.rows[0].count)).toBe(32);
  });

  // Add more integration tests
});
