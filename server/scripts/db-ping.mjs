/**
 * Sanity check Postgres connectivity (loads server/.env if present).
 * Usage: npm run db:ping
 */
import pg from 'pg';

function toPostgresql(cs) {
  if (!cs) return null;
  return cs.startsWith('postgres://') ? `postgresql://${cs.slice('postgres://'.length)}` : cs;
}

function inspect(label, cs) {
  if (!cs) {
    console.log(`${label}: (not set)`);
    return;
  }
  try {
    const u = new URL(toPostgresql(cs));
    const usr = decodeURIComponent(u.username.replace(/\+/g, '%20'));
    console.log(`${label}: user="${usr}" host=${u.hostname} port=${u.port || '5432'} db=${u.pathname.replace(/^\//, '')}`);
  } catch {
    console.log(`${label}: (invalid URL)`);
  }
}

async function ping(label, cs) {
  const n = toPostgresql(cs);
  if (!n) {
    console.log(`${label}: skip`);
    return;
  }
  const pool = new pg.Pool({ connectionString: n, ssl: { rejectUnauthorized: false } });
  try {
    const { rows } = await pool.query('SELECT current_user AS u, current_database() AS d');
    console.log(`${label}: OK`, rows[0]);
  } catch (e) {
    console.log(`${label}: FAIL`, e.code || '(no code)', e.message.split('\n')[0]);
  } finally {
    await pool.end();
  }
}

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

inspect('DIRECT_URL', directUrl);
inspect('DATABASE_URL', databaseUrl);

await ping('via DIRECT_URL', directUrl);
await ping('via DATABASE_URL', databaseUrl);
