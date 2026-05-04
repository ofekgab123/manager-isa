import { randomUUID } from 'crypto';

const MAX_ENTRIES = 80;
/** @type {Array<object>} */
const entries = [];

function sanitizeHeaders(headers) {
  const secretLike = new Set([
    'authorization',
    'x-make-webhook-secret',
    'x-webhook-secret',
    'x-manager-isa-webhook-secret',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const lk = String(k).toLowerCase();
    if (secretLike.has(lk)) {
      out[k] = '[redacted]';
    } else if (Array.isArray(v)) {
      out[k] = v.map(String);
    } else {
      out[k] = v != null ? String(v) : '';
    }
  }
  return out;
}

function sanitizeBody(body) {
  if (body == null) return body;
  if (typeof body !== 'object') return body;
  const o = Array.isArray(body) ? [...body] : { ...body };
  if (!Array.isArray(o) && typeof o.secret === 'string') o.secret = '[redacted]';
  return o;
}

const WEBHOOK_RAW_BODY_MAX_CHARS = 500_000;

/** Redact common secret patterns in the raw UTF-8 body string (for inspector display only). */
function redactRawWebhookBodyText(str) {
  if (typeof str !== 'string' || str.length === 0) return null;
  let s = str.length > WEBHOOK_RAW_BODY_MAX_CHARS
    ? `${str.slice(0, WEBHOOK_RAW_BODY_MAX_CHARS)}\n… [truncated]`
    : str;
  s = s.replace(/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[redacted]"');
  s = s.replace(/"secret"\s*:\s*[^\s,}\]]+/gi, '"secret":[redacted]');
  return s;
}

export function snapshotMakeWebhookRequest(req) {
  const rawUtf8 = req.webhookRawBodyUtf8;
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: { ...(req.query || {}) },
    headers: sanitizeHeaders(req.headers),
    contentType: req.headers['content-type'] != null ? String(req.headers['content-type']) : null,
    body: sanitizeBody(req.body),
    bodyAsReceivedText: rawUtf8 != null ? redactRawWebhookBodyText(rawUtf8) : null,
  };
}

export function pushMakeWebhookInbound(record) {
  entries.unshift({
    id: randomUUID(),
    ...record,
  });
  while (entries.length > MAX_ENTRIES) entries.pop();
}

export function getMakeWebhookInboundEntries() {
  return entries.map((e) => ({ ...e }));
}

export function clearMakeWebhookInbound() {
  entries.length = 0;
}

const DEBUG_CAPTURE_MAX = 100;
/** @type {Array<object>} */
const debugCaptures = [];

/**
 * Full inbound snapshot for debugging (e.g. point Make at this URL temporarily).
 * Stored in memory only; restart clears the list.
 */
export function pushMakeWebhookDebugCapture(record) {
  const id = randomUUID();
  const receivedAt = new Date().toISOString();
  debugCaptures.unshift({
    id,
    receivedAt,
    ...record,
  });
  while (debugCaptures.length > DEBUG_CAPTURE_MAX) debugCaptures.pop();
  return { id, receivedAt };
}

export function getMakeWebhookDebugCaptures() {
  return debugCaptures.map((e) => ({ ...e }));
}

export function clearMakeWebhookDebugCaptures() {
  debugCaptures.length = 0;
}
