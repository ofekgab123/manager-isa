import { initDb } from '../db.js';
import pool from '../db.js';

try {
  await initDb();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

process.exit(process.exitCode ?? 0);
