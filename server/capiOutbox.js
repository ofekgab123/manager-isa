import { waitUntil } from '@vercel/functions';
import pool from './db.js';
import { findLeadByPhoneKey, findUserIdByPhone, updateMissionCapiFields } from './storage.js';
import { israeliMobileKey } from './phoneKey.js';
import {
  buildPurchaseBody,
  decidePurchase,
  outboxAfterFailure,
  postPurchaseToMeta,
  safeCapiAttribution,
  sumDeliveriesContentsIls,
} from './capi.js';

const SENDING_STALE_MS = 2 * 60 * 1000;

function delayMs(attemptsAfterFailure) {
  const ms = 60_000 * 2 ** Math.max(0, attemptsAfterFailure - 1);
  return Math.min(ms, 6 * 60 * 60 * 1000);
}

async function writeOutbox(id, data) {
  await pool.query(`UPDATE capi_outbox SET data = $2::jsonb WHERE id = $1`, [id, data]);
}

export async function hasPendingCapiOutbox(missionId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM capi_outbox
     WHERE data->>'missionId' = $1
       AND data->>'status' IN ('pending', 'sending')
     LIMIT 1`,
    [missionId],
  );
  return rows.length > 0;
}

export async function insertCapiOutbox(row) {
  await pool.query(`INSERT INTO capi_outbox (id, data) VALUES ($1, $2::jsonb)`, [row.id, row]);
}

export async function preparePurchaseForMission(prev, next) {
  const value = sumDeliveriesContentsIls(next?.deliveries);
  const hasPending = next?.id ? await hasPendingCapiOutbox(next.id) : false;
  const decision = decidePurchase(prev, next, { hasPending, value });
  if (decision.action === 'ignore') return { mission: next, outbox: null };

  const phoneKey = israeliMobileKey(next.customerPhone);
  const lead = phoneKey ? await findLeadByPhoneKey(phoneKey) : null;
  const attribution = safeCapiAttribution(next, lead);

  if (decision.action === 'skip') {
    return {
      mission: {
        ...next,
        capi_status: 'skipped',
        capi_event_id: decision.eventId,
        capi_sent_at: null,
        capi_response: { reason: decision.reason },
        capiAttribution: attribution,
      },
      outbox: null,
    };
  }

  const externalId = await findUserIdByPhone(next.customerPhone);
  const eventTimeSec = Math.floor(Date.now() / 1000);
  const payload = buildPurchaseBody({
    mission: next,
    lead,
    externalId,
    value,
    eventTimeSec,
    eventId: decision.eventId,
    wabaId: (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim(),
  });
  const now = new Date().toISOString();
  const outbox = {
    id: `CAPI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    missionId: next.id,
    eventId: decision.eventId,
    payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    createdAt: now,
    claimedAt: null,
    sentAt: null,
    eventsReceived: null,
    fbtraceId: null,
    attribution,
  };
  return {
    mission: {
      ...next,
      capi_status: 'pending',
      capi_event_id: decision.eventId,
      capi_sent_at: null,
      capi_response: null,
      capiAttribution: attribution,
    },
    outbox,
  };
}

async function releaseStaleSending() {
  const { rows } = await pool.query(
    `SELECT id, data FROM capi_outbox WHERE data->>'status' = 'sending'`,
  );
  const cutoff = Date.now() - SENDING_STALE_MS;
  for (const row of rows) {
    const claimed = Date.parse(row.data?.claimedAt || '');
    if (!Number.isFinite(claimed) || claimed < cutoff) {
      await writeOutbox(row.id, { ...row.data, status: 'pending' });
    }
  }
}

async function claimOutbox(id) {
  const claimedAt = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE capi_outbox
     SET data = jsonb_set(jsonb_set(data, '{status}', '"sending"'::jsonb), '{claimedAt}', to_jsonb($2::text))
     WHERE id = $1 AND data->>'status' = 'pending'
     RETURNING data`,
    [id, claimedAt],
  );
  return rows[0]?.data || null;
}

async function applySendResult(row, result) {
  const now = new Date().toISOString();
  if (result.ok) {
    const next = {
      ...row,
      status: 'sent',
      sentAt: now,
      lastError: null,
      eventsReceived: result.events_received,
      fbtraceId: result.fbtrace_id,
    };
    await writeOutbox(row.id, next);
    await updateMissionCapiFields(row.missionId, {
      capi_status: 'sent',
      capi_sent_at: now,
      capi_event_id: row.eventId,
      capi_response: {
        events_received: result.events_received,
        fbtrace_id: result.fbtrace_id,
      },
    });
    return;
  }

  const failure = outboxAfterFailure({ attempts: row.attempts, error: result.error });
  const next = {
    ...row,
    status: failure.status,
    attempts: failure.attempts,
    lastError: result.error || 'Meta request failed',
    fbtraceId: result.fbtrace_id || row.fbtraceId || null,
    nextAttemptAt: new Date(Date.now() + delayMs(Math.max(1, failure.attempts))).toISOString(),
  };
  await writeOutbox(row.id, next);
  if (failure.giveUp) {
    await updateMissionCapiFields(row.missionId, {
      capi_status: 'failed',
      capi_event_id: row.eventId,
      capi_response: {
        error: next.lastError,
        fbtrace_id: next.fbtraceId,
      },
    });
  }
}

let processing = false;

export async function processDueCapiOutbox() {
  if (processing) return { processed: 0 };
  processing = true;
  let processed = 0;
  try {
    await releaseStaleSending();
    const now = new Date().toISOString();
    const { rows } = await pool.query(
      `SELECT id, data FROM capi_outbox
       WHERE data->>'status' = 'pending'
         AND COALESCE(data->>'nextAttemptAt', '') <= $1
       ORDER BY data->>'nextAttemptAt' ASC
       LIMIT 20`,
      [now],
    );
    for (const row of rows) {
      const claimed = await claimOutbox(row.id);
      if (!claimed) continue;
      const result = await postPurchaseToMeta(claimed.payload);
      await applySendResult(claimed, result);
      processed += 1;
      if (!result.ok) {
        console.error('[capi] send failed', claimed.missionId, result.error, result.fbtrace_id || '');
      }
    }
    return { processed };
  } finally {
    processing = false;
  }
}

let lastKick = 0;

export function kickCapiRetries() {
  const now = Date.now();
  if (now - lastKick < 30_000) return;
  lastKick = now;
  scheduleCapiProcessing();
}

export async function scheduleCapiProcessing() {
  const task = processDueCapiOutbox().catch((err) => {
    console.error('[capi] background', err?.message || err);
  });
  if (process.env.VERCEL === '1') {
    try {
      waitUntil(task);
    } catch (err) {
      console.error('[capi] waitUntil unavailable', err?.message || err);
    }
  }
}
