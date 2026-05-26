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

/** Single-row insert — avoids DELETE + re-insert of the entire table on create. */
export async function insertMissionData(id, data) {
  await pool.query(
    `INSERT INTO missions (id, data) VALUES ($1, $2::jsonb)`,
    [id, data]
  );
}

/** Single-row update — avoids DELETE + re-insert of the entire table (very slow for large mission lists). */
export async function updateMissionsData(id, data) {
  const { rowCount } = await pool.query(
    `UPDATE missions SET data = $2::jsonb WHERE id = $1`,
    [id, data]
  );
  if (rowCount === 0) throw new Error('Mission not found');
}

export async function deleteMissionsById(id) {
  const { rowCount } = await pool.query('DELETE FROM missions WHERE id = $1', [id]);
  if (rowCount === 0) throw new Error('Mission not found');
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

/** Normalize country for container grouping / default lookup (India, thailand, TH → india | thailand). */
export function containerCountryKey(country) {
  if (country == null || String(country).trim() === '') return '';
  const s = String(country).trim().toLowerCase();
  if (s === 'india') return 'india';
  if (s === 'thailand' || s === 'th') return 'thailand';
  return String(country).trim();
}

/** At most one container per country may have isDefault true; first in array order keeps it. */
export function normalizeContainersDefault(containers) {
  if (!Array.isArray(containers) || containers.length === 0) return containers;
  const seen = new Set();
  return containers.map((c) => {
    if (!c.isDefault) return { ...c, isDefault: false };
    const key = containerCountryKey(c.country);
    if (seen.has(key)) return { ...c, isDefault: false };
    seen.add(key);
    return { ...c, isDefault: true };
  });
}

function containersDefaultNeedsNormalize(containers) {
  if (!Array.isArray(containers)) return false;
  const seen = new Set();
  for (const c of containers) {
    if (!c.isDefault) continue;
    const key = containerCountryKey(c.country);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Must match server/app.js CONTAINER_STATUSES + legacy keys from older UI. */
const CONTAINER_STATUS_IDS = [
  'in_storage_tlv',
  'in_transit',
  'in_customs_clearance',
  'door_to_door_in_progress',
];
const LEGACY_CONTAINER_STATUS = {
  open: 'in_storage_tlv',
  closed: 'in_transit',
  completed: 'door_to_door_in_progress',
};

function migrateContainerStatus(status) {
  if (status == null || String(status).trim() === '') return 'in_storage_tlv';
  const s = String(status).trim();
  if (CONTAINER_STATUS_IDS.includes(s)) return s;
  return LEGACY_CONTAINER_STATUS[s] ?? 'in_storage_tlv';
}

/** Ensure `statusTimestamps[status]` exists (backfill from createdAt) for tracking UI. */
function migrateContainerStatusTimestamps(c) {
  const status = c.status || 'in_storage_tlv';
  const prev = c.statusTimestamps;
  const validPrev = prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev } : null;
  let dirty = validPrev == null;
  const ts = validPrev ?? {};
  if (!ts[status] && c.createdAt) {
    ts[status] = c.createdAt;
    dirty = true;
  }
  if (dirty) return { record: { ...c, statusTimestamps: ts }, dirty: true };
  return { record: c, dirty: false };
}

export async function readContainers() {
  const raw = await readTable('containers');
  if (!Array.isArray(raw)) return raw;

  let list = raw.map((c) => {
    const status = migrateContainerStatus(c.status);
    return { ...c, status };
  });
  const statusDirty = raw.some((c) => migrateContainerStatus(c.status) !== c.status);

  let tsDirty = false;
  list = list.map((c) => {
    const { record, dirty } = migrateContainerStatusTimestamps(c);
    if (dirty) tsDirty = true;
    return record;
  });

  const defNeeds = containersDefaultNeedsNormalize(list);
  if (!statusDirty && !defNeeds && !tsDirty) return list;

  const normalized = normalizeContainersDefault(list);
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
