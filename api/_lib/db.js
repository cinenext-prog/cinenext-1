import pg from 'pg';

const { Pool } = pg;

const getPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  if (!globalThis.__cinenextDbPool) {
    globalThis.__cinenextDbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL_DISABLE === 'true' ? false : { rejectUnauthorized: false },
    });
  }

  return globalThis.__cinenextDbPool;
};

export const query = async (text, params = []) => {
  const pool = getPool();
  return pool.query(text, params);
};
