import pool from './db.js';

async function readTable(table) {
  const { rows } = await pool.query(
    `SELECT data FROM ${table} ORDER BY (data->>'createdAt') DESC NULLS LAST`
  );
  return rows.map((r) => r.data);
}

async function writeTable(table, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${table}`);
    for (const item of items) {
      await client.query(
        `INSERT INTO ${table} (id, data) VALUES ($1, $2)`,
        [item.id, JSON.stringify(item)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function readOrders() {
  return readTable('orders');
}

export async function writeOrders(orders) {
  return writeTable('orders', orders);
}

export async function readAffiliates() {
  return readTable('affiliates');
}

export async function writeAffiliates(affiliates) {
  return writeTable('affiliates', affiliates);
}

export async function readMissions() {
  return readTable('missions');
}

export async function writeMissions(missions) {
  return writeTable('missions', missions);
}

export async function readUsers() {
  return readTable('users');
}

export async function writeUsers(users) {
  return writeTable('users', users);
}

export async function readReceivers() {
  return readTable('receivers');
}

export async function writeReceivers(receivers) {
  return writeTable('receivers', receivers);
}

/** At most one container may have isDefault true; first in array order keeps it. */
export function normalizeContainersDefault(containers) {
  if (!Array.isArray(containers) || containers.length === 0) return containers;
  let seenDefault = false;
  return containers.map((c) => {
    if (c.isDefault) {
      if (seenDefault) return { ...c, isDefault: false };
      seenDefault = true;
      return { ...c, isDefault: true };
    }
    return { ...c, isDefault: false };
  });
}

function containersDefaultNeedsNormalize(containers) {
  if (!Array.isArray(containers)) return false;
  return containers.filter((c) => c.isDefault).length > 1;
}

export async function readContainers() {
  const raw = await readTable('containers');
  if (!containersDefaultNeedsNormalize(raw)) return raw;
  const normalized = normalizeContainersDefault(raw);
  await writeTable('containers', normalized);
  return normalized;
}

export async function writeContainers(containers) {
  return writeTable('containers', normalizeContainersDefault(containers));
}

export async function readParcelContentTypes() {
  return readTable('parcel_content_types');
}

export async function writeParcelContentTypes(types) {
  return writeTable('parcel_content_types', types);
}
