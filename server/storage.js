import pool from './db.js';
import { israeliMobileKey } from './phoneKey.js';

async function readTable(table) {
  const { rows } = await pool.query(
    `SELECT data FROM ${table} ORDER BY (data->>'createdAt') DESC NULLS LAST`
  );
  return rows.map((r) => r.data);
}

const STRIP_HEAVY_MEDIA_SQL = `
CREATE OR REPLACE FUNCTION isa_strip_heavy_media(j jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  k text;
  v jsonb;
  result jsonb;
  elem jsonb;
  arr jsonb := '[]'::jsonb;
  txt text;
BEGIN
  IF j IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(j) = 'object' THEN
    result := '{}'::jsonb;
    FOR k, v IN SELECT key, value FROM jsonb_each(j)
    LOOP
      IF k IN ('imageUrl', 'videoUrl') THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v) = 'string' THEN
        txt := v #>> '{}';
        IF txt LIKE 'data:image/%' OR txt LIKE 'data:video/%' THEN
          CONTINUE;
        END IF;
        result := result || jsonb_build_object(k, v);
      ELSE
        result := result || jsonb_build_object(k, isa_strip_heavy_media(v));
      END IF;
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(j) = 'array' THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(j)
    LOOP
      arr := arr || jsonb_build_array(isa_strip_heavy_media(elem));
    END LOOP;
    RETURN arr;
  ELSE
    RETURN j;
  END IF;
END;
$fn$;
`;

let stripMediaReady = null;

async function ensureStripHeavyMedia() {
  if (!stripMediaReady) {
    stripMediaReady = pool.query(STRIP_HEAVY_MEDIA_SQL).catch((err) => {
      stripMediaReady = null;
      throw err;
    });
  }
  return stripMediaReady;
}

/** List payload without address photos/videos. Stripping runs in Postgres so those bytes never leave the pooler. */
export async function readMissionsList() {
  try {
    await ensureStripHeavyMedia();
    const { rows } = await pool.query(
      `SELECT isa_strip_heavy_media(data) AS data
       FROM missions
       ORDER BY (data->>'createdAt') DESC NULLS LAST`
    );
    return rows.map((r) => r.data);
  } catch (err) {
    console.error('[db] slim mission list failed', err?.message || err);
    return readTable('missions');
  }
}

export async function readMissionByIdCI(id) {
  const { rows } = await pool.query(
    `SELECT data FROM missions WHERE upper(id) = upper($1) LIMIT 1`,
    [id],
  );
  return rows[0]?.data ?? null;
}

export async function findMissionByDeliveryToken(tokenUpper) {
  const { rows } = await pool.query(
    `SELECT data FROM missions
     WHERE EXISTS (
       SELECT 1
       FROM jsonb_array_elements(
         CASE
           WHEN jsonb_typeof(data->'deliveries') = 'array' THEN data->'deliveries'
           ELSE '[]'::jsonb
         END
       ) AS d
       WHERE upper(COALESCE(d->>'id', '')) = $1
          OR (
            jsonb_typeof(d->'boxTrackingIds') = 'array'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(d->'boxTrackingIds') AS t
              WHERE upper(t) = $1
            )
          )
     )
     LIMIT 1`,
    [tokenUpper],
  );
  return rows[0]?.data ?? null;
}

export async function findMissionByLionwheelTaskId(taskId) {
  const { rows } = await pool.query(
    `SELECT data FROM missions
     WHERE data->'lionwheel'->>'taskId' = $1
     LIMIT 1`,
    [String(taskId)],
  );
  return rows[0]?.data ?? null;
}

export async function listCompletedPickupAffiliates(completedStatus) {
  const { rows } = await pool.query(
    `SELECT data->>'customerPhone' AS phone,
            data->>'affiliateName' AS affiliate
     FROM missions
     WHERE data->>'type' = 'pickup'
       AND COALESCE(data->>'affiliateName', '') <> ''
       AND data->'lionwheel'->>'taskStatus' = $1`,
    [String(completedStatus)],
  );
  return rows;
}

export async function readOrderById(id) {
  const { rows } = await pool.query(`SELECT data FROM orders WHERE id = $1`, [id]);
  return rows[0]?.data ?? null;
}

export async function updateOrderData(id, data) {
  const { rowCount } = await pool.query(
    `UPDATE orders SET data = $2::jsonb WHERE id = $1`,
    [id, data],
  );
  if (rowCount === 0) throw new Error('Order not found');
}

export async function findOrderByLionwheelTaskId(taskId) {
  const { rows } = await pool.query(
    `SELECT data FROM orders
     WHERE data->'lionwheel'->>'taskId' = $1
     LIMIT 1`,
    [String(taskId)],
  );
  return rows[0]?.data ?? null;
}

export async function readOrdersForPhoneKey(phoneKey) {
  if (!phoneKey) return [];
  const { rows } = await pool.query(`SELECT id, data->>'customerPhone' AS phone FROM orders`);
  const ids = rows.filter((r) => israeliMobileKey(r.phone) === phoneKey).map((r) => r.id);
  if (ids.length === 0) return [];
  const { rows: full } = await pool.query(
    `SELECT data FROM orders
     WHERE id = ANY($1::text[])
     ORDER BY (data->>'createdAt') DESC NULLS LAST`,
    [ids],
  );
  return full.map((r) => r.data);
}

async function findUserIdByPhoneKey(phoneKey) {
  if (!phoneKey) return null;
  const { rows } = await pool.query(`SELECT id, data->>'phone' AS phone FROM users`);
  const hit = rows.find((r) => israeliMobileKey(r.phone) === phoneKey);
  return hit?.id || null;
}

export async function findUserByPhoneKey(phoneKey) {
  const id = await findUserIdByPhoneKey(phoneKey);
  if (!id) return null;
  const { rows } = await pool.query(`SELECT data FROM users WHERE id = $1`, [id]);
  return rows[0]?.data ?? null;
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

export async function readMissionById(id) {
  const { rows } = await pool.query(`SELECT data FROM missions WHERE id = $1`, [id]);
  return rows[0]?.data ?? null;
}

export async function countPickupLinksForEmptyBox(emptyBoxId, excludeMissionId = null) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM missions
     WHERE data->>'type' = 'pickup'
       AND data->>'linkedEmptyBoxMissionId' = $1
       AND ($2::text IS NULL OR id <> $2)`,
    [emptyBoxId, excludeMissionId],
  );
  return rows[0]?.n ?? 0;
}

function slimReceiverAddress(address) {
  if (!address || typeof address !== 'object') return address || null;
  const rest = Object.fromEntries(
    Object.entries(address).filter(([key]) => key !== 'imageUrl' && key !== 'videoUrl'),
  );
  return Object.keys(rest).length ? rest : null;
}

/** Single-row receiver upsert — avoids DELETE + re-insert of the entire receivers table. */
export async function upsertReceiverByPhone({ fullName, phone, address }) {
  const key = israeliMobileKey(phone);
  const slimAddress = slimReceiverAddress(address);

  if (key) {
    const { rows } = await pool.query(`SELECT id, data->>'phone' AS phone FROM receivers`);
    const existing = rows.find((r) => israeliMobileKey(r.phone) === key);
    if (existing) {
      const { rows: full } = await pool.query(`SELECT data FROM receivers WHERE id = $1`, [existing.id]);
      const prev = full[0]?.data || {};
      const updated = {
        ...prev,
        fullName: fullName || prev.fullName,
        phone: phone || prev.phone,
        address: slimAddress || slimReceiverAddress(prev.address) || prev.address || null,
      };
      await pool.query(`UPDATE receivers SET data = $2::jsonb WHERE id = $1`, [existing.id, updated]);
      return updated;
    }
  }

  const created = {
    id: `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: fullName || '',
    phone: phone || '',
    address: slimAddress,
    createdAt: new Date().toISOString(),
  };
  await pool.query(`INSERT INTO receivers (id, data) VALUES ($1, $2::jsonb)`, [created.id, created]);
  return created;
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

/** Single-row user write — avoids DELETE + re-insert of entire users table on profile merge. */
export async function insertUserData(id, data) {
  await pool.query(`INSERT INTO users (id, data) VALUES ($1, $2::jsonb)`, [id, data]);
}

export async function updateUserData(id, data) {
  const { rowCount } = await pool.query(`UPDATE users SET data = $2::jsonb WHERE id = $1`, [id, data]);
  if (rowCount === 0) throw new Error('User not found');
}

/** Update one customer profile by phone, or insert a new user row. */
export async function upsertCustomerProfileByPhone(phone, { fullName, address }) {
  const key = israeliMobileKey(phone);
  if (!key || key.length < 7) return;
  if (!address || typeof address !== 'object') return;

  const existing = await findUserByPhoneKey(key);

  if (existing) {
    const next = {
      ...existing,
      fullName: fullName || existing.fullName,
      address: { ...address },
    };
    await updateUserData(existing.id, next);
    return next;
  }

  const created = {
    id: `USR-${Date.now()}`,
    fullName: fullName || '',
    phone,
    address: { ...address },
    notes: '',
    createdAt: new Date().toISOString(),
  };
  await insertUserData(created.id, created);
  return created;
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

export async function readContainerById(id) {
  if (!id) return null;
  const { rows } = await pool.query(`SELECT data FROM containers WHERE id = $1`, [id]);
  return rows[0]?.data ?? null;
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

export async function readLeads() {
  return readTable('leads');
}

export async function insertLeadData(id, data) {
  await pool.query(`INSERT INTO leads (id, data) VALUES ($1, $2::jsonb)`, [id, data]);
}

/** Insert an import batch in one database round trip. */
export async function insertLeadsData(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return;
  await pool.query(
    `INSERT INTO leads (id, data)
     SELECT item->>'id', item
     FROM jsonb_array_elements($1::jsonb) AS item`,
    [JSON.stringify(leads)],
  );
}

export async function updateLeadData(id, data) {
  const { rowCount } = await pool.query(`UPDATE leads SET data = $2::jsonb WHERE id = $1`, [id, data]);
  if (rowCount === 0) throw new Error('Lead not found');
}

export async function deleteLeadById(id) {
  const { rowCount } = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
  if (rowCount === 0) throw new Error('Lead not found');
}

export async function deleteLeadsByIds(ids) {
  const unique = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };
  await pool.query(`DELETE FROM messages WHERE data->>'leadId' = ANY($1::text[])`, [unique]);
  const { rowCount } = await pool.query('DELETE FROM leads WHERE id = ANY($1::text[])', [unique]);
  return { deleted: rowCount };
}

export async function findLeadByPhoneKey(phoneKey) {
  if (!phoneKey) return null;
  const { rows } = await pool.query(
    `SELECT data FROM leads WHERE data->>'phoneKey' = $1 LIMIT 1`,
    [phoneKey],
  );
  return rows[0]?.data ?? null;
}

export async function readMessageTemplates() {
  return readTable('message_templates');
}

export async function writeMessageTemplates(templates) {
  return writeTable('message_templates', templates);
}

export async function insertMessageTemplateData(id, data) {
  await pool.query(`INSERT INTO message_templates (id, data) VALUES ($1, $2::jsonb)`, [id, data]);
}

export async function updateMessageTemplateData(id, data) {
  const { rowCount } = await pool.query(
    `UPDATE message_templates SET data = $2::jsonb WHERE id = $1`,
    [id, data],
  );
  if (rowCount === 0) throw new Error('Template not found');
}

export async function readMessagesForLead(leadId) {
  const { rows } = await pool.query(
    `SELECT data FROM messages WHERE data->>'leadId' = $1 ORDER BY (data->>'sentAt') DESC NULLS LAST`,
    [leadId],
  );
  return rows.map((r) => r.data);
}

export async function insertMessageData(id, data) {
  await pool.query(`INSERT INTO messages (id, data) VALUES ($1, $2::jsonb)`, [id, data]);
}

export async function findUserIdByPhone(phone) {
  const key = israeliMobileKey(phone);
  if (!key || key.length < 7) return null;
  return findUserIdByPhoneKey(key);
}

export async function updateMissionCapiFields(id, fields) {
  const { rowCount } = await pool.query(
    `UPDATE missions
     SET data = data || $2::jsonb
     WHERE id = $1`,
    [id, fields],
  );
  if (rowCount === 0) return null;
  return readMissionById(id);
}

export async function listMissionsByCapiStatus(statuses) {
  const { rows } = await pool.query(
    `SELECT data FROM missions
     WHERE data->>'capi_status' = ANY($1::text[])
     ORDER BY COALESCE(data->>'capi_sent_at', data->>'updatedAt', data->>'createdAt') DESC`,
    [statuses],
  );
  return rows.map((r) => r.data);
}

export async function listCapiOutboxByStatus(statuses) {
  const { rows } = await pool.query(
    `SELECT data FROM capi_outbox
     WHERE data->>'status' = ANY($1::text[])
     ORDER BY COALESCE(data->>'createdAt', '') DESC`,
    [statuses],
  );
  return rows.map((r) => r.data);
}

export async function updateMessageByWaMessageId(waMessageId, patch) {
  const { rows } = await pool.query(`SELECT id, data FROM messages WHERE data->>'waMessageId' = $1`, [
    waMessageId,
  ]);
  if (rows.length === 0) return null;
  const next = { ...rows[0].data, ...patch };
  await pool.query(`UPDATE messages SET data = $2::jsonb WHERE id = $1`, [rows[0].id, next]);
  return next;
}
