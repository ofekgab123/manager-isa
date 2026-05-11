import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: adminRows } = await pool.query(
    `SELECT id FROM auth_users WHERE username = $1`,
    ['admin']
  );
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash('admin', 10);
    await pool.query(
      'INSERT INTO auth_users (id, username, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
      [`AU-${Date.now()}`, 'admin', hash, true]
    );
    console.log('Created default admin user (username: admin, password: admin)');
  }

  console.log('Database tables initialized');
}

export default pool;
