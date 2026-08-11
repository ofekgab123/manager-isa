import { randomBytes } from 'crypto';
import pool from './db.js';

function newLogId() {
  return `LWIL-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * @param {object} entry — full log document (id/receivedAt may be set by caller or here)
 */
export async function insertLwIntegrationLog(entry) {
  const data = {
    ...entry,
    id: entry.id || newLogId(),
    receivedAt: entry.receivedAt || new Date().toISOString(),
  };
  await pool.query(
    `INSERT INTO lw_integration_logs (id, data) VALUES ($1, $2::jsonb)`,
    [data.id, data],
  );
  return data;
}

/**
 * @param {{ destination?: string|null, limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: object[], total: number }>}
 */
export async function readLwIntegrationLogs({ destination = null, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const params = [];
  let where = '';
  if (destination) {
    params.push(destination);
    where = `WHERE data->>'destination' = $${params.length}`;
  }

  const countSql = `SELECT COUNT(*)::int AS total FROM lw_integration_logs ${where}`;
  const { rows: countRows } = await pool.query(countSql, params);
  const total = countRows[0]?.total ?? 0;

  params.push(safeLimit);
  params.push(safeOffset);
  const listSql = `
    SELECT data FROM lw_integration_logs
    ${where}
    ORDER BY data->>'receivedAt' DESC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(listSql, params);
  return { entries: rows.map((r) => r.data), total };
}
