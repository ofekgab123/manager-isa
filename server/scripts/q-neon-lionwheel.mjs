/**
 * One-shot: NEON_DATABASE_URL=... node scripts/q-neon-lionwheel.mjs
 * Does not commit credentials; URI from env only.
 */
import pg from 'pg';

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error('Missing NEON_DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const statsSql = `
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE data ? 'lionwheel')::int AS with_lionwheel,
    COUNT(*) FILTER (WHERE nullif(trim(COALESCE(data->'lionwheel'->>'taskId','')), '') IS NOT NULL)::int AS with_task_id
  FROM`;

try {
  await pool.query('SELECT 1');

  const m = await pool.query(`${statsSql} missions`);
  const o = await pool.query(`${statsSql} orders`);

  console.log('NEON missions:', m.rows[0]);
  console.log('NEON orders:', o.rows[0]);

  const samp = await pool.query(`
    SELECT id, data->'lionwheel' AS lw
    FROM missions
    WHERE data ? 'lionwheel'
    ORDER BY id DESC
    LIMIT 8
  `);
  console.log(
    'Sample (missions with lionwheel key):',
    samp.rows.map((r) => ({
      id: r.id,
      taskId: r.lw?.taskId,
      syncError: r.lw?.syncError ? '(has syncError)' : null,
    })),
  );
} catch (e) {
  console.error('Neon query failed:', e.code || '', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
