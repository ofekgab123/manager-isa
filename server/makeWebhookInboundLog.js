import { randomUUID } from 'crypto';

const MAX_ENTRIES = 80;
/** @type {Array<object>} */
const entries = [];

function sanitizeHeaders(headers) {
  const secretLike = new Set([
    'authorization',
    'x-make-webhook-secret',
    'x-webhook-secret',
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

export function snapshotMakeWebhookRequest(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: { ...(req.query || {}) },
    headers: sanitizeHeaders(req.headers),
    body: sanitizeBody(req.body),
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
