import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  // Supabase: use session pool (:5432) for DDL when DIRECT_URL is set; app traffic stays on DATABASE_URL (:6543).
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const migrateCs = directUrl || databaseUrl || '';
  if (!migrateCs) throw new Error('DATABASE_URL or DIRECT_URL required');

  const useSeparateMigratePool = Boolean(directUrl && directUrl !== databaseUrl);
  const migratePool = useSeparateMigratePool
    ? new Pool({
        connectionString: migrateCs,
        ssl: { rejectUnauthorized: false },
      })
    : pool;

  try {
    await migratePool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS affiliates (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS receivers (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS parcel_content_types (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        country TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await migratePool.query(`
      ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS country TEXT;
    `);

    const { rows: adminRows } = await migratePool.query(
      `SELECT id FROM auth_users WHERE username = $1`,
      ['admin']
    );
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await migratePool.query(
        'INSERT INTO auth_users (id, username, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
        [`AU-${Date.now()}`, 'admin', hash, true]
      );
      console.log('Created default admin user (username: admin, password: admin)');
    }

    console.log('Database tables initialized');
  } finally {
    if (migratePool !== pool) await migratePool.end();
  }
}

export default pool;
