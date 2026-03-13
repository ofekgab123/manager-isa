/**
 * One-time data migration: reads existing JSON files from server/data/
 * and inserts them into PostgreSQL. Safe to run multiple times (uses upsert).
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { initDb } from './db.js';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filename) {
  const file = path.join(__dirname, 'data', filename);
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

async function migrateTable(table, items) {
  if (!items.length) {
    console.log(`  ${table}: no data to migrate`);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `INSERT INTO ${table} (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [item.id, JSON.stringify(item)]
      );
    }
    await client.query('COMMIT');
    console.log(`  ${table}: migrated ${items.length} record(s)`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  await initDb();

  console.log('Starting data migration...');

  await migrateTable('orders',               readJson('orders.json'));
  await migrateTable('missions',             readJson('missions.json'));
  await migrateTable('containers',           readJson('containers.json'));
  await migrateTable('affiliates',           readJson('affiliates.json'));
  await migrateTable('users',                readJson('users.json'));
  await migrateTable('parcel_content_types', readJson('parcel-content-types.json'));

  console.log('Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
