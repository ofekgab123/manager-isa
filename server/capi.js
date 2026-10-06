import crypto from 'crypto';

/** Current stable Graph API version (v26.0, July 2026). */
export const META_GRAPH_VERSION = 'v26.0';
export const META_PIXEL_ID = '701369365757716';
export const MISSING_CAPI_TOKEN_ERROR = 'META_CAPI_TOKEN is not configured';
export const CAPI_MAX_ATTEMPTS = 8;

const WEBSITE_ATTR_KEYS = [
  'fbp',
  'fbc',
  'fbclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'client_ip_address',
  'client_user_agent',
  'event_source_url',
  'lead_event_id',
];

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Digits only, country code 972, no leading 0. 0521234567 → 972521234567. */
export function normalizePhoneForMeta(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits) return '';
  if (digits.length === 9) return `972${digits}`;
  return digits;
}

/** Lowercase, collapse extra spaces, strip punctuation. Hebrew stays UTF-8. */
export function normalizeMatchText(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export function sumDeliveriesContentsIls(deliveries) {
  if (!Array.isArray(deliveries)) return 0;
  let sum = 0;
  for (const delivery of deliveries) {
    const boxes = delivery?.boxContents;
    if (!Array.isArray(boxes)) continue;
    for (const box of boxes) {
      if (!Array.isArray(box)) continue;
      for (const item of box) {
        const qty = Math.max(0, Number(item?.qty) || 0);
        const price = Math.max(0, Number(item?.price) || 0);
        sum += qty * price;
      }
    }
  }
  return Math.round(sum * 100) / 100;
}

export function decidePurchase(prev, next, { hasPending = false, value = 0 } = {}) {
  if (next?.type !== 'pickup') return { action: 'ignore' };
  if (prev?.status === 'completed' || next?.status !== 'completed') return { action: 'ignore' };
  const eventId = `deal_${next.id}_won`;
  if (next.capi_status === 'sent' && next.capi_event_id === eventId) return { action: 'ignore', eventId };
  if (hasPending) return { action: 'ignore', eventId };
  if (!(Number(value) > 0)) return { action: 'skip', eventId, reason: 'no_value' };
  return { action: 'enqueue', eventId };
}

function hashed(value) {
  if (!value) return null;
  return [sha256Hex(value)];
}

function contentCategory(country) {
  const value = String(country || '').trim().toLowerCase();
  if (value === 'india' || value === 'thailand') return value;
  return '';
}

function leadIsWhatsApp(lead) {
  if (!lead) return false;
  return lead.channel === 'whatsapp' || lead.source === 'whatsapp_inbound' || Boolean(lead.ctwaClid);
}

export function websiteAttributionFromBody(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  for (const key of WEBSITE_ATTR_KEYS) {
    const raw = body[key];
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (!text) continue;
    out[key] = text.slice(0, 2048);
  }
  if (!out.fbc && out.fbclid) {
    out.fbc = `fb.1.${Date.now()}.${out.fbclid}`.slice(0, 2048);
  }
  return out;
}

export function safeCapiAttribution(mission, lead) {
  const whatsapp = leadIsWhatsApp(lead);
  const website = Boolean(mission?.fbp || mission?.fbc || mission?.utm_source || mission?.utm_campaign);
  return {
    channel: whatsapp ? 'whatsapp' : (website ? 'website' : null),
    sourceId: lead?.waSourceId || null,
    businessPhone: lead?.businessPhone || null,
    utmCampaign: mission?.utm_campaign || null,
  };
}

/**
 * Purchase body for Meta Conversions API.
 * Hashed fields are hex SHA-256. Empty values are omitted.
 */
export function buildPurchaseBody({
  mission,
  lead = null,
  externalId = null,
  value,
  eventTimeSec,
  eventId,
  wabaId = '',
}) {
  const userData = {};
  const phone = normalizePhoneForMeta(mission?.customerPhone);
  const phoneHash = hashed(phone);
  if (phoneHash) userData.ph = phoneHash;

  const first = normalizeMatchText(mission?.firstName);
  const last = normalizeMatchText(mission?.lastName);
  const full = normalizeMatchText(mission?.fullName);
  const fn = hashed(first || full);
  const ln = hashed(last);
  if (fn) userData.fn = fn;
  if (ln) userData.ln = ln;

  const city = normalizeMatchText(mission?.senderAddress?.city || mission?.address?.city);
  const cityHash = hashed(city);
  if (cityHash) userData.ct = cityHash;

  userData.country = hashed('il');

  const external = hashed(externalId ? String(externalId) : '');
  if (external) userData.external_id = external;

  if (mission?.fbc) userData.fbc = mission.fbc;
  if (mission?.fbp) userData.fbp = mission.fbp;
  if (mission?.client_ip_address) userData.client_ip_address = mission.client_ip_address;
  if (mission?.client_user_agent) userData.client_user_agent = mission.client_user_agent;

  const ctwa = lead?.ctwaClid || '';
  const messaging = Boolean(ctwa);
  if (messaging) {
    userData.ctwa_clid = ctwa;
    if (wabaId) userData.whatsapp_business_account_id = wabaId;
  }

  const customData = {
    value: Number(value),
    currency: 'ILS',
    order_id: String(mission.id),
  };
  const category = contentCategory(mission?.country);
  if (category) customData.content_category = category;
  if (leadIsWhatsApp(lead)) customData.lead_channel = 'whatsapp';
  else if (mission?.fbp || mission?.fbc || mission?.utm_source || mission?.utm_campaign) {
    customData.lead_channel = 'website';
  }
  for (const key of ['utm_campaign', 'utm_content', 'utm_term', 'utm_source', 'utm_medium', 'utm_id']) {
    if (mission?.[key]) customData[key] = mission[key];
  }

  const event = {
    event_name: 'Purchase',
    event_time: eventTimeSec,
    event_id: eventId,
    action_source: messaging ? 'business_messaging' : 'system_generated',
    user_data: userData,
    custom_data: customData,
  };
  if (messaging) event.messaging_channel = 'whatsapp';
  if (typeof mission?.event_source_url === 'string' && /^https?:\/\//.test(mission.event_source_url)) {
    event.event_source_url = mission.event_source_url;
  }

  return { data: [event] };
}

/** Missing token stays pending so adding META_CAPI_TOKEN later still sends. */
export function outboxAfterFailure({ attempts = 0, error = '' } = {}) {
  if (error === MISSING_CAPI_TOKEN_ERROR) {
    return { status: 'pending', attempts: Number(attempts) || 0, giveUp: false };
  }
  const nextAttempts = (Number(attempts) || 0) + 1;
  const giveUp = nextAttempts >= CAPI_MAX_ATTEMPTS;
  return { status: giveUp ? 'failed' : 'pending', attempts: nextAttempts, giveUp };
}

/** Vercel Cron calls production with this user agent and schedule header. CRON_SECRET is optional. */
export function isCapiCronRequest(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const header = String(req?.headers?.authorization || '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (secret && bearer === secret) return true;
  const ua = String(req?.headers?.['user-agent'] || '');
  const schedule = req?.headers?.['x-vercel-cron-schedule'];
  return ua.startsWith('vercel-cron/') && typeof schedule === 'string' && schedule.length > 0;
}

/** Public client IP from a proxied request. Ignores junk header values. */
export function clientIpFromRequest(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  const candidate = raw || String(req?.ip || '').replace(/^::ffff:/, '');
  if (!candidate || candidate.length > 64) return '';
  if (!/^[0-9a-fA-F:.]+$/.test(candidate)) return '';
  return candidate;
}

export function capiEventsUrl() {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events`;
}

export async function postPurchaseToMeta(body) {
  const token = (process.env.META_CAPI_TOKEN || '').trim();
  if (!token) {
    return { ok: false, error: MISSING_CAPI_TOKEN_ERROR, fbtrace_id: null, events_received: null };
  }
  const payload = { ...body };
  const testCode = (process.env.META_TEST_EVENT_CODE || '').trim();
  if (testCode) payload.test_event_code = testCode;

  let response;
  try {
    response = await fetch(capiEventsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: err.message || 'Meta request failed', fbtrace_id: null, events_received: null };
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  const fbtraceId = parsed?.fbtrace_id || parsed?.error?.fbtrace_id || null;
  if (!response.ok) {
    const message = parsed?.error?.message || `Meta HTTP ${response.status}`;
    return { ok: false, error: message, fbtrace_id: fbtraceId, events_received: parsed?.events_received ?? null };
  }
  return {
    ok: true,
    error: null,
    fbtrace_id: fbtraceId,
    events_received: parsed?.events_received ?? null,
  };
}

/** Admin-safe view: hashes stay, raw identifiers do not. */
export function redactPurchaseBody(body) {
  const clone = JSON.parse(JSON.stringify(body || {}));
  const user = clone?.data?.[0]?.user_data;
  if (user) {
    for (const key of ['client_ip_address', 'client_user_agent', 'ctwa_clid', 'fbc', 'fbp']) {
      if (user[key]) user[key] = '<present>';
    }
  }
  return clone;
}
