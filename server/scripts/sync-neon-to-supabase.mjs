/**
 * Merge JSONB-backed rows from Neon into Supabase (target from .env).
 * Usage:
 *   NEON_DATABASE_URL='postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require' \
 *     npm run db:sync-neon
 *
 * Prefer DIRECT_URL for target writes; falls back to DATABASE_URL.
 * Merge: UPSERT per id — Neon wins on id clashes; rows only on Supabase stay.
 */

import pg from 'pg';

const TABLES = [
  'orders',
  'missions',
  'containers',
  'affiliates',
  'users',
  'receivers',
  'parcel_content_types',
];

function poolFor(url, label) {
  if (!url?.trim()) {
    console.error(`Missing connection URL for ${label}`);
    process.exit(1);
  }
  const u = url.trim();
  return new pg.Pool({
    connectionString: u,
    ssl: u.includes('localhost') ? false : { rejectUnauthorized: false },
  });
}

async function syncJsonTable(source, target, table) {
  const qTable = `"${table.replace(/"/g, '')}"`;
  const { rows } = await source.query(`SELECT id, data FROM ${qTable} ORDER BY id`);
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows on Neon — skip`);
    return;
  }
  const client = await target.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const payload = typeof row.data === 'object' && row.data !== null ? JSON.stringify(row.data) : row.data;
      await client.query(
        `INSERT INTO ${qTable} (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [row.id, payload],
      );
    }
    await client.query('COMMIT');
    console.log(`  ${table}: upserted ${rows.length} row(s)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function syncAuthUsers(source, target) {
  let rows;
  try {
    ({ rows } = await source.query(
      `SELECT id, username, password_hash, is_admin, country, created_at FROM auth_users`,
    ));
  } catch {
    console.log(`  auth_users: not present / unreadable on Neon — skip`);
    return;
  }
  if (!rows?.length) {
    console.log(`  auth_users: 0 rows — skip`);
    return;
  }
  const client = await target.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        `INSERT INTO auth_users (id, username, password_hash, is_admin, country, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           is_admin = EXCLUDED.is_admin,
           country = COALESCE(EXCLUDED.country, auth_users.country)`,
        [
          row.id,
          row.username,
          row.password_hash,
          row.is_admin,
          row.country ?? null,
          row.created_at ?? new Date(),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`  auth_users: upserted ${rows.length} row(s)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const neonUrl = process.env.NEON_DATABASE_URL?.trim();
const targetUrl = (
  process.env.SUPABASE_MIGRATE_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL
)?.trim();

if (!neonUrl) {
  console.error('Set NEON_DATABASE_URL to your Neon pooled connection string.');
  process.exit(1);
}

const source = poolFor(neonUrl, 'Neon (source)');
const target = poolFor(targetUrl, 'Supabase (target)');

const modeHint = targetUrl.includes(':5432') && targetUrl.includes('pooler')
  ? 'session pool'
  : targetUrl.includes('6543')
    ? 'txn pool'
    : 'direct';
console.log(`Neon → Supabase merge (target transport: ~${modeHint})`);

try {
  for (const t of TABLES) {
    await syncJsonTable(source, target, t);
  }
  await syncAuthUsers(source, target);
  console.log('Done.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
