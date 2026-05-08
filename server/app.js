import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { readOrders, writeOrders, readAffiliates, writeAffiliates, readMissions, writeMissions, updateMissionsData, deleteMissionsById, readUsers, writeUsers, readReceivers, writeReceivers, readContainers, writeContainers, readParcelContentTypes, writeParcelContentTypes, containerCountryKey } from './storage.js';
import { israeliMobileKey } from './phoneKey.js';
import {
  createLionWheelTaskForEmptyBoxMission,
  createLionWheelTaskForPickupMission,
  buildLionWheelPayloadFromRequest,
  sendLionWheelCreatePayload,
  fetchLionWheelTaskShow,
  lionWheelTaskStatusLabel,
  lionWheelDestinationFromMission,
  extractLionWheelWebhookFields,
  LIONWHEEL_TASK_STATUS_COMPLETED,
} from './lionwheel.js';
import { notifyEmptyBoxMissionWebhook } from './missionWebhook.js';
import {
  snapshotMakeWebhookRequest,
  pushMakeWebhookInbound,
  getMakeWebhookInboundEntries,
  clearMakeWebhookInbound,
  pushMakeWebhookDebugCapture,
  getMakeWebhookDebugCaptures,
  clearMakeWebhookDebugCaptures,
} from './makeWebhookInboundLog.js';

const JWT_SECRET = process.env.JWT_SECRET || 'isa-manager-jwt-secret-key';
/** POST /api/webhooks/make-lionwheel-status — Make.com forwards LionWheel payload; must match env secret. */
const MAKE_LIONWHEEL_WEBHOOK_SECRET = (process.env.MAKE_LIONWHEEL_WEBHOOK_SECRET || 'lionnwheelhttp12313ff').trim();
/** POST /api/webhooks/make-inspect — log full inbound from Make for debugging; defaults to same secret as LionWheel. */
const MAKE_WEBHOOK_INSPECT_SECRET = (process.env.MAKE_WEBHOOK_INSPECT_SECRET || MAKE_LIONWHEEL_WEBHOOK_SECRET).trim();
/** Shared with isa-express-web (VITE_MANAGER_SERVICE_KEY). Bearer value must match. Legacy: VITE_CUSTOMER_SITE_API_KEY in server .env. */
const SERVICE_KEY = (process.env.MANAGER_SERVICE_KEY || process.env.VITE_CUSTOMER_SITE_API_KEY || '').trim();

/** Webhook auth: Authorization Bearer, or plain secret in X-Manager-Isa-Webhook-Secret / X-Webhook-Secret (helps Make / proxies). */
function lionWheelWebhookProvidedSecret(req) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (auth) return auth;
  const pick = (name) => {
    const v = req.headers[name];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v[0]) return String(v[0]).trim();
    return '';
  };
  return pick('x-manager-isa-webhook-secret') || pick('x-webhook-secret');
}

const app = express();

function resolveDefaultPickupContainerId(containersList, bodyCountry) {
  const hasCountry =
    bodyCountry !== undefined && bodyCountry !== null && String(bodyCountry).trim() !== '';
  if (hasCountry) {
    const key = String(bodyCountry).trim();
    const def = containersList.find(
      (c) => c.isDefault && containerCountryKey(c.country) === key,
    );
    return def ? def.id : null;
  }
  const legacy = containersList.find((c) => c.isDefault);
  return legacy ? legacy.id : null;
}

/** auth_users.country (India / Thailand) → same ids as LionWheel region (stored on mission.country for empty_box). */
function userAuthCountryToShippingDestId(country) {
  if (country == null || String(country).trim() === '') return null;
  const s = String(country).trim().toLowerCase();
  if (s === 'india') return 'india';
  if (s === 'thailand' || s === 'th') return 'thailand';
  return null;
}

/**
 * empty_box: visible when LionWheel region (country or legacy shippingDestination) matches the user’s country.
 * pickup: visible when container is in the user’s country (containerId in set).
 */
function missionVisibleForUserCountry(m, userCountry, containerIdsForUser) {
  if (!userCountry) return true;
  const wantDest = userAuthCountryToShippingDestId(userCountry);
  if (m.type === 'empty_box') {
    if (!wantDest) return false;
    return lionWheelDestinationFromMission(m) === wantDest;
  }
  if (m.type === 'pickup') {
    if (!m.containerId) return false;
    return containerIdsForUser.has(m.containerId);
  }
  return false;
}

async function filterMissionsForCountryUser(missions, user) {
  if (!user?.country || user.isAdmin) return missions;
  const containers = await readContainers();
  const ids = new Set(containers.filter((c) => c.country === user.country).map((c) => c.id));
  return missions.filter((m) => missionVisibleForUserCountry(m, user.country, ids));
}

async function assertMissionAccessForCountryUser(mission, user) {
  if (!user?.country || user.isAdmin) return;
  const containers = await readContainers();
  const ids = new Set(containers.filter((c) => c.country === user.country).map((c) => c.id));
  if (!missionVisibleForUserCountry(mission, user.country, ids)) {
    throw new Error('FORBIDDEN_MISSION');
  }
}

const LW_STATUS_REFRESH_MS = 10 * 60 * 1000;
const LW_STATUS_RETRY_AFTER_ERROR_MS = 2 * 60 * 1000;
const LW_STATUS_REFRESH_CAP = 40;

/** Serialize affiliate.json updates so parallel LW status refreshes cannot drop increments. */
let affiliatesUpdateChain = Promise.resolve();

async function runSerializedAffiliateUpdate(updater) {
  const run = affiliatesUpdateChain.then(updater, updater);
  affiliatesUpdateChain = run.catch(() => {});
  return run;
}

/**
 * Increment affiliate `orderCount` once when a pickup mission first reaches LionWheel Completed (status 3).
 */
async function creditAffiliateIfPickupJustCompletedLionWheel(prevMission, nextMission) {
  if (nextMission.type !== 'pickup' || !nextMission.affiliateName) return;
  const prevStatus = Number(prevMission?.lionwheel?.taskStatus);
  const nextStatus = Number(nextMission.lionwheel?.taskStatus);
  if (prevStatus === LIONWHEEL_TASK_STATUS_COMPLETED || nextStatus !== LIONWHEEL_TASK_STATUS_COMPLETED) return;
  if (!Number.isFinite(nextStatus)) return;
  await runSerializedAffiliateUpdate(async () => {
    try {
      const affiliates = await readAffiliates();
      const idx = affiliates.findIndex((a) => a.name === nextMission.affiliateName);
      if (idx === -1) return;
      affiliates[idx] = {
        ...affiliates[idx],
        orderCount: (affiliates[idx].orderCount || 0) + 1,
      };
      await writeAffiliates(affiliates);
    } catch {
      /* ignore */
    }
  });
}

async function enrichMissionsWithLionWheelStatuses(missions, { force = false } = {}) {
  const now = Date.now();
  let candidates = missions.filter((m) => {
    const lw = m.lionwheel;
    if (!lw?.taskId) return false;
    const dest = lionWheelDestinationFromMission(m);
    if (!dest) return false;
    if (force) return true;
    const fetchedAt = lw.taskStatusFetchedAt ? new Date(lw.taskStatusFetchedAt).getTime() : 0;
    const ttl = lw.taskStatusFetchError ? LW_STATUS_RETRY_AFTER_ERROR_MS : LW_STATUS_REFRESH_MS;
    const cacheFresh = now - fetchedAt < ttl;
    if (cacheFresh) return false;
    return true;
  });
  if (!force) {
    candidates = candidates.slice(0, LW_STATUS_REFRESH_CAP);
  }

  /** Row-level writes only — full-table writeMissions() races with LionWheel webhooks and can wipe their updates. */
  const changedMissionIds = new Set();
  const batch = 6;
  for (let i = 0; i < candidates.length; i += batch) {
    await Promise.all(
      candidates.slice(i, i + batch).map(async (m) => {
        const dest = lionWheelDestinationFromMission(m);
        if (!dest) return;
        const fr = await fetchLionWheelTaskShow(m.lionwheel.taskId, dest, { originalOrderId: m.id });
        const idx = missions.findIndex((x) => x.id === m.id);
        if (idx === -1) return;
        const prevMission = missions[idx];
        if (!fr.ok || typeof fr.taskStatus !== 'number') {
          const rawMsg =
            fr.skipped && fr.reason
              ? fr.reason
              : fr.error || (fr.status ? `HTTP ${fr.status}` : 'Unknown error');
          const msg = rawMsg.length > 500 ? `${rawMsg.slice(0, 497)}…` : rawMsg;
          missions[idx] = {
            ...missions[idx],
            lionwheel: {
              ...missions[idx].lionwheel,
              taskStatusFetchedAt: new Date().toISOString(),
              taskStatusFetchError: msg,
            },
          };
          changedMissionIds.add(missions[idx].id);
          return;
        }
        missions[idx] = {
          ...missions[idx],
          lionwheel: {
            ...missions[idx].lionwheel,
            taskStatus: fr.taskStatus,
            taskStatusLabel: lionWheelTaskStatusLabel(fr.taskStatus),
            taskStatusFetchedAt: new Date().toISOString(),
            taskStatusFetchError: undefined,
          },
        };
        await creditAffiliateIfPickupJustCompletedLionWheel(prevMission, missions[idx]);
        changedMissionIds.add(missions[idx].id);
      }),
    );
  }
  if (changedMissionIds.size > 0) {
    await Promise.all(
      [...changedMissionIds].map((mid) => {
        const row = missions.find((x) => x.id === mid);
        if (!row) return Promise.resolve();
        return updateMissionsData(mid, row);
      }),
    );
  }
}

/** Customer empty-box flow: eventual ship-to (India / Thailand) — same ids as isa-express-web */
const VALID_SHIPPING_DESTINATIONS = new Set(['india', 'thailand']);

function normalizeShippingDestination(missionType, raw) {
  if (missionType !== 'empty_box') return null;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  return VALID_SHIPPING_DESTINATIONS.has(s) ? s : null;
}

/** India / Thailand from customer POST: `country` and/or legacy `shippingDestination` — same for empty_box and pickup. */
function lwRegionFromCustomerBody(country, shippingDestination) {
  return (
    userAuthCountryToShippingDestId(country) ||
    userAuthCountryToShippingDestId(shippingDestination) ||
    normalizeShippingDestination('empty_box', shippingDestination)
  );
}

/**
 * Pickup: shippingDestination is always null in DB. For LionWheel only: infer india/thailand from
 * mission.country, linked empty_box, or pickup container when those fields are set.
 */
async function pickupLionWheelDestinationFallback(mission, missionsList) {
  if (mission.type !== 'pickup') return null;
  if (lionWheelDestinationFromMission(mission)) return null;
  if (mission.linkedEmptyBoxMissionId) {
    const eb = missionsList.find(
      (m) => m.id === mission.linkedEmptyBoxMissionId && m.type === 'empty_box',
    );
    if (eb) {
      const d = lionWheelDestinationFromMission({
        shippingDestination: eb.shippingDestination,
        country: eb.country,
      });
      if (d) return d;
    }
  }
  if (mission.containerId) {
    const containersList = await readContainers();
    const c = containersList.find((x) => x.id === mission.containerId);
    return userAuthCountryToShippingDestId(c?.country);
  }
  return null;
}

/**
 * Maps pickup/empty_box order → mission-shaped snapshot for LionWheel create (same contract as POST /api/missions:
 * `original_order_id` is the stored order id; task ids come from the LW response).
 */
function missionLikeFromOrderForLionWheel(order) {
  if (!order || (order.type !== 'pickup' && order.type !== 'empty_box')) return null;
  const addr = order.senderAddress || order.address || null;
  return {
    id: order.id,
    type: order.type,
    fullName: order.fullName || '',
    firstName: order.firstName || null,
    lastName: order.lastName || null,
    customerPhone: order.customerPhone || '',
    address: addr,
    senderAddress: order.senderAddress || null,
    receiverName: order.receiverName || null,
    receiverPhone: order.receiverPhone || null,
    receiverAddress: order.receiverAddress || null,
    boxSelection: order.boxSelection || { large: 0, small: 0 },
    bringBoxes: order.bringBoxes !== undefined ? order.bringBoxes : null,
    pickupBoxCount:
      order.type === 'pickup' ? order.pickupBoxCount ?? order.boxes ?? 0 : null,
    boxes: order.boxes ?? 0,
    notes: order.notes || null,
    country: order.country ?? null,
    shippingDestination: null,
    containerId: order.containerId ?? null,
    linkedEmptyBoxMissionId: order.linkedEmptyBoxMissionId ?? null,
  };
}

// DB migration: add country column to auth_users if it doesn't exist
pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS country VARCHAR(50)`).catch(() => {});
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      'https://manager-isa.vercel.app',
      'https://isa-psi-six.vercel.app',
      'https://isa-32uqdb92z-ofekgab123s-projects.vercel.app',
      'https://isa-git-main-ofekgab123s-projects.vercel.app',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ];
    if (!origin || allowed.includes(origin) || /^https:\/\/isa-.*-ofekgab123s-projects\.vercel\.app$/.test(origin)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Manager-Isa-Webhook-Secret', 'X-Webhook-Secret'],
}));

const WEBHOOK_JSON_SNAPSHOT_PATHS = new Set([
  '/api/webhooks/lionwheel-task',
  '/api/webhooks/make-lionwheel-status',
  '/api/webhooks/make-inspect',
]);

function isWebhookJsonSnapshotRoute(req) {
  const candidates = [
    req.path,
    req.originalUrl?.split('?')[0],
    req.url?.split('?')[0],
  ].filter(Boolean);
  return candidates.some((p) => WEBHOOK_JSON_SNAPSHOT_PATHS.has(p));
}

app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (req.method !== 'POST' || !isWebhookJsonSnapshotRoute(req)) return;
    try {
      req.webhookRawBodyUtf8 = buf.toString(encoding || 'utf8');
    } catch {
      req.webhookRawBodyUtf8 = buf.toString('utf8');
    }
  },
}));

// ─── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  // Under app.use('/api', …) req.path is e.g. /missions, not /api/missions
  if (req.method === 'POST' && req.path === '/missions') {
    const createdBy = req.body?.createdBy ?? 'customer';
    if (createdBy === 'customer') return next();
  }
  // Public: orders filtered by customer phone (last 9 digits) — customer home / login checks (isa-express-web)
  if (req.method === 'GET' && req.path === '/orders' && req.query.customerPhone) {
    return next();
  }
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7).trim();
  if (SERVICE_KEY && token && token === SERVICE_KEY) {
    req.user = {
      id: 'service-isa-express',
      username: 'isa-express',
      isAdmin: false,
      country: null,
      service: true,
    };
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ─── Auth routes (public) ──────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const { rows } = await pool.query('SELECT * FROM auth_users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin, country: user.country || null },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, isAdmin: user.is_admin, country: user.country || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, isAdmin: req.user.isAdmin, country: req.user.country || null });
});

// ─── Auth users CRUD (admin only) ─────────────────────────────────────────────

app.get('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, country, created_at FROM auth_users ORDER BY created_at ASC'
    );
    res.json(rows.map((r) => ({ id: r.id, username: r.username, isAdmin: r.is_admin, country: r.country || null, createdAt: r.created_at })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin, country } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const hash = await bcrypt.hash(password, 10);
    const id = `AU-${Date.now()}`;
    const countryVal = !isAdmin && country ? country : null;
    await pool.query(
      'INSERT INTO auth_users (id, username, password_hash, is_admin, country) VALUES ($1, $2, $3, $4, $5)',
      [id, username.trim(), hash, !!isAdmin, countryVal]
    );
    res.status(201).json({ id, username: username.trim(), isAdmin: !!isAdmin, country: countryVal });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin, country } = req.body;
    const { rows } = await pool.query('SELECT * FROM auth_users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (username !== undefined) { updates.push(`username = $${idx++}`); values.push(username.trim()); }
    if (password)               { updates.push(`password_hash = $${idx++}`); values.push(await bcrypt.hash(password, 10)); }
    if (isAdmin !== undefined)  { updates.push(`is_admin = $${idx++}`); values.push(!!isAdmin); }
    if (country !== undefined)  {
      const effectiveAdmin = isAdmin !== undefined ? !!isAdmin : rows[0].is_admin;
      updates.push(`country = $${idx++}`);
      values.push(!effectiveAdmin && country ? country : null);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);
    await pool.query(`UPDATE auth_users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    const { rows: updated } = await pool.query(
      'SELECT id, username, is_admin, country, created_at FROM auth_users WHERE id = $1', [req.params.id]
    );
    const u = updated[0];
    res.json({ id: u.id, username: u.username, isAdmin: u.is_admin, country: u.country || null, createdAt: u.created_at });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const { rowCount } = await pool.query('DELETE FROM auth_users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: lookup customer by phone (for client-side auto-fill, no auth) ──────

app.get('/api/customers/by-phone', async (req, res) => {
  try {
    const qDigits = (req.query.phone || '').replace(/\D/g, '');
    if (qDigits.length < 7) return res.json(null);
    const qKey = israeliMobileKey(req.query.phone);
    if (!qKey) return res.json(null);
    const users = await readUsers();
    const match = users.find((u) => israeliMobileKey(u.phone) === qKey);
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: affiliate by slug (customer landing links, no auth) ───────────────

app.get('/api/affiliates/by-slug/:slug', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    const affiliate = affiliates.find(
      (a) => a.slug === req.params.slug && a.active !== false
    );
    if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });
    res.json({ name: affiliate.name, discountAmount: affiliate.discountAmount, slug: affiliate.slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: promo code validation (order forms, no auth) ────────────────────

app.post('/api/promo/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, error: 'Code is required' });
    const affiliates = await readAffiliates();
    const affiliate = affiliates.find(
      (a) => a.promoCode.toUpperCase() === code.toUpperCase().trim() && a.active !== false
    );
    if (!affiliate) return res.json({ valid: false });
    res.json({
      valid: true,
      affiliateName: affiliate.name,
      affiliateId: affiliate.id,
      discountAmount: affiliate.discountAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function phoneTailDigits(phone) {
  const k = israeliMobileKey(phone);
  if (!k || k.length < 7) return null;
  return k;
}

// ─── Public: affiliate for returning customer (by phone) — no manual promo code ─

app.post('/api/affiliates/auto-for-phone', async (req, res) => {
  try {
    const tail = phoneTailDigits(req.body?.phone);
    if (!tail) return res.json({ match: false });

    const [affiliates, missions] = await Promise.all([readAffiliates(), readMissions()]);

    const payload = (aff) => ({
      match: true,
      affiliateName: aff.name,
      discountAmount: aff.discountAmount,
      promoCode: aff.promoCode,
      slug: aff.slug,
    });

    for (const m of missions) {
      if (phoneTailDigits(m.customerPhone) !== tail) continue;
      if (m.type !== 'pickup' || !m.affiliateName) continue;
      if (Number(m.lionwheel?.taskStatus) !== LIONWHEEL_TASK_STATUS_COMPLETED) continue;
      const aff = affiliates.find((a) => a.name === m.affiliateName && a.active !== false);
      if (aff) return res.json(payload(aff));
    }

    for (const aff of affiliates) {
      if (aff.active === false) continue;
      for (const c of aff.importedCustomers || []) {
        if (phoneTailDigits(c?.phone) === tail) {
          return res.json(payload(aff));
        }
      }
    }

    return res.json({ match: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * When a customer mission is created, store that address on the user profile (same phone),
 * so /api/customers/by-phone returns the last order location. Does not depend on a separate upsert from the site.
 */
async function mergeCustomerAddressFromCustomerMission(body, missionType) {
  const phone = body.customerPhone;
  const key = israeliMobileKey(phone);
  if (!key || key.length < 7) return;
  const addr = missionType === 'pickup' ? body.senderAddress : body.address;
  if (!addr || typeof addr !== 'object') return;
  const hasGeo = addr.lat != null && addr.lng != null;
  const hasText = String(addr.displayAddress || addr.city || addr.street || '').trim();
  if (!hasGeo && !hasText) return;

  const fullName =
    (body.fullName && String(body.fullName).trim()) ||
    [body.firstName, body.lastName].filter(Boolean).join(' ').trim() ||
    '';

  const users = await readUsers();
  const idx = users.findIndex((u) => israeliMobileKey(u.phone) === key);
  if (idx !== -1) {
    users[idx] = {
      ...users[idx],
      fullName: fullName || users[idx].fullName,
      address: { ...addr },
    };
  } else {
    users.unshift({
      id: `USR-${Date.now()}`,
      fullName: fullName,
      phone: body.customerPhone,
      address: { ...addr },
      notes: '',
      createdAt: new Date().toISOString(),
    });
  }
  await writeUsers(users);
}

// Affiliate discount applies only to pickup missions
function affiliateFieldsForMissionType(missionType, body) {
  if (missionType !== 'pickup') {
    return { affiliateName: null, discountAmount: null };
  }
  return {
    affiliateName: body.affiliateName || null,
    discountAmount: body.discountAmount != null ? body.discountAmount : null,
  };
}

// ─── Public: POST /api/missions (no auth - for customer-facing forms) ──────────

app.post('/api/missions', async (req, res) => {
  try {
    const missions = await readMissions();
    const body = req.body;
    const validTypes = ['empty_box', 'pickup'];
    const missionType = validTypes.includes(body.type) ? body.type : 'pickup';
    const { affiliateName, discountAmount } = affiliateFieldsForMissionType(missionType, body);
    /** empty_box & pickup: LionWheel / UI region on mission.country (india|thailand). shippingDestination always null in DB. */
    const lwRegionFromBody =
      missionType === 'empty_box' || missionType === 'pickup'
        ? lwRegionFromCustomerBody(body.country, body.shippingDestination)
        : null;
    let pickupContainerId = null;
    if (missionType === 'pickup') {
      if (Object.prototype.hasOwnProperty.call(body, 'containerId')) {
        pickupContainerId = body.containerId || null;
      } else {
        const containersList = await readContainers();
        pickupContainerId = resolveDefaultPickupContainerId(containersList, body.country);
      }
    }
    const newMission = {
      id: `MSN-${Date.now()}`,
      type: missionType,
      status: body.status ?? (body.createdBy === 'customer' ? 'received' : 'linewhel_transferred'),
      createdBy: body.createdBy || 'customer',
      createdAt: body.createdAt || new Date().toISOString(),
      fullName: body.fullName || '',
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      customerPhone: body.customerPhone || '',
      address: body.address || null,
      senderAddress: body.senderAddress || null,
      receiverName: body.receiverName || null,
      receiverPhone: body.receiverPhone || null,
      receiverAddress: body.receiverAddress || null,
      boxes: body.boxes || 0,
      boxSelection: body.boxSelection || { large: 0, small: 0 },
      bringBoxes: body.bringBoxes !== undefined ? body.bringBoxes : null,
      pickupBoxCount: body.pickupBoxCount ?? null,
      pickupBoxWeights: Array.isArray(body.pickupBoxWeights) ? body.pickupBoxWeights : null,
      deliveries: Array.isArray(body.deliveries) ? body.deliveries : undefined,
      notes: body.notes || body.orderNotes || null,
      affiliateName,
      discountAmount,
      linkedEmptyBoxMissionId: body.linkedEmptyBoxMissionId || null,
      containerId: missionType === 'pickup' ? pickupContainerId : null,
      country:
        missionType === 'empty_box' || missionType === 'pickup'
          ? lwRegionFromBody ?? body.country ?? null
          : body.country ?? null,
      shippingDestination: null,
    };

    let missionForLw = newMission;
    if (missionType === 'pickup' && !lionWheelDestinationFromMission(newMission)) {
      const fb = await pickupLionWheelDestinationFallback(newMission, missions);
      if (fb) missionForLw = { ...newMission, shippingDestination: fb };
    }

    missions.unshift(newMission);
    await writeMissions(missions);

    let missionToReturn = newMission;
    /** empty_box & pickup: always attempt LionWheel on create (customer forms included). Retry via POST /api/missions/:id/send-to-lionwheel if needed. */
    const shouldSyncLionWheel = missionType === 'empty_box' || missionType === 'pickup';
    if (shouldSyncLionWheel) {
      try {
        const lw =
          missionType === 'empty_box'
            ? await createLionWheelTaskForEmptyBoxMission(newMission)
            : await createLionWheelTaskForPickupMission(missionForLw);
        if (!lw.skipped) {
          const lionwheel = lw.ok
            ? {
                taskId: lw.taskId,
                publicId: lw.publicId,
                trackingLink: lw.trackingLink,
                barcode: lw.barcode,
                label: lw.label,
                destinationRegionStr: lw.destinationRegionStr,
                syncedAt: new Date().toISOString(),
              }
            : {
                syncError: lw.error,
                syncHttpStatus: lw.status,
                syncAttemptedAt: new Date().toISOString(),
              };
          missionToReturn = { ...newMission, lionwheel };
          const i = missions.findIndex((m) => m.id === newMission.id);
          if (i !== -1) missions[i] = missionToReturn;
          await writeMissions(missions);
        }
      } catch (e) {
        const lionwheel = {
          syncError: e.message || String(e),
          syncAttemptedAt: new Date().toISOString(),
        };
        missionToReturn = { ...newMission, lionwheel };
        const i = missions.findIndex((m) => m.id === newMission.id);
        if (i !== -1) missions[i] = missionToReturn;
        await writeMissions(missions);
      }
    }

    if (!body.createdBy || body.createdBy === 'customer') {
      try {
        await mergeCustomerAddressFromCustomerMission(body, missionType);
      } catch {
        /* mission already stored */
      }
    }

    if (missionType === 'empty_box') {
      notifyEmptyBoxMissionWebhook(missionToReturn).catch((e) =>
        console.warn('[MISSION_WEBHOOK_URL]', e.message || e),
      );
    }
    if (missionType === 'pickup') {
      notifyEmptyBoxMissionWebhook(missionToReturn).catch((e) =>
        console.warn('[MISSION_WEBHOOK_URL pickup]', e.message || e),
      );
    }

    res.status(201).json(missionToReturn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lionwheel/create — standalone LionWheel task creation (auth required) ──

app.post('/api/lionwheel/create', requireAuth, async (req, res) => {
  try {
    const { orderId, type, boxes, emptyBoxes, city, street, number, name, phone, destination } = req.body || {};

    const missing = [];
    if (!orderId) missing.push('orderId');
    if (!type || !['pickup', 'empty'].includes(type)) missing.push('type (pickup|empty)');
    if (!destination || !['thailand', 'india'].includes(String(destination).toLowerCase())) missing.push('destination (thailand|india)');
    if (!city) missing.push('city');
    if (!street) missing.push('street');
    if (!number) missing.push('number');
    if (!name) missing.push('name');
    if (!phone) missing.push('phone');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const payload = buildLionWheelPayloadFromRequest({
      orderId, type, boxes: boxes || 0, emptyBoxes: emptyBoxes || 0,
      city, street, number, name, phone, destination,
    });

    const lw = await sendLionWheelCreatePayload(payload, destination);

    if (lw.skipped) {
      return res.status(503).json({ error: 'LionWheel credentials not configured', detail: lw.reason });
    }
    if (!lw.ok) {
      return res.status(502).json({ error: lw.error, lionwheel_status: lw.status });
    }

    return res.json({
      success: true,
      task_id: lw.taskId,
      public_id: lw.publicId,
      tracking_link: lw.trackingLink,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: GET /api/track/:id — lookup by package ID (PKG-…) or mission ID (MSN-…) ─

app.get('/api/track/:id', async (req, res) => {
  try {
    const rawId = req.params.id.trim();
    const missions = await readMissions();
    let mission = null;
    let delivery = null;
    let packageId = null;

    if (rawId.toUpperCase().startsWith('MSN-')) {
      // Direct mission lookup
      mission = missions.find((m) => m.id.toUpperCase() === rawId.toUpperCase());
    } else {
      // 1. Search by boxTrackingId inside deliveries
      for (const m of missions) {
        const deliveries = m.deliveries?.length > 0 ? m.deliveries : [];
        for (const d of deliveries) {
          const tids = (d.boxTrackingIds ?? []).map((t) => (t || '').trim().toUpperCase());
          if (tids.includes(rawId.toUpperCase())) {
            mission = m; delivery = d; packageId = rawId.toUpperCase(); break;
          }
        }
        if (mission) break;
      }

      // 2. Try synthesized PKG-{missionNum}-{idx}
      if (!mission) {
        const synthMatch = rawId.match(/^PKG-(\d+)-(\d+)$/i);
        if (synthMatch) {
          const msnId = `MSN-${synthMatch[1]}`;
          const idx = parseInt(synthMatch[2], 10);
          const m = missions.find((ms) => ms.id === msnId);
          if (m) {
            const deliveries = m.deliveries?.length > 0
              ? m.deliveries
              : [{ receiverName: m.receiverName || '', receiverPhone: m.receiverPhone || '', address: m.receiverAddress || null, boxCount: m.pickupBoxCount ?? 1 }];
            if (idx < deliveries.length) {
              mission = m; delivery = deliveries[idx]; packageId = rawId.toUpperCase();
            }
          }
        }
      }

      // 3. Fallback: explicit d.id match
      if (!mission) {
        for (const m of missions) {
          const deliveries = m.deliveries?.length > 0 ? m.deliveries : [];
          const d = deliveries.find((dv) => dv.id && dv.id.toUpperCase() === rawId.toUpperCase());
          if (d) { mission = m; delivery = d; packageId = d.id; break; }
        }
      }
    }

    if (!mission) return res.status(404).json({ error: 'Not found' });

    let container = null;
    if (mission.containerId) {
      const containers = await readContainers();
      const c = containers.find((cnt) => cnt.id === mission.containerId);
      if (c) {
        const ts =
          c.statusTimestamps && typeof c.statusTimestamps === 'object' && !Array.isArray(c.statusTimestamps)
            ? { ...c.statusTimestamps }
            : {};
        container = {
          id: c.id,
          name: c.name,
          status: c.status,
          estimatedArrivalAt: c.estimatedArrivalAt,
          country: c.country,
          statusTimestamps: ts,
        };
      }
    }

    res.json({
      id: packageId || mission.id,
      missionId: mission.id,
      status: mission.status,
      type: mission.type,
      createdAt: mission.createdAt,
      receiverName: delivery?.receiverName || mission.receiverName || null,
      container,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * LionWheel / Make → distilled taskId + status → update mission.lionwheel or order.lionwheel in DB.
 * Native payload: `{ task: { id, status, order_id, … } }` or root `{ id, status }`.
 * On 200: JSON includes `id` (task id) and `status` (0–10) for Make / clients.
 * Auth: Authorization: Bearer <MAKE_LIONWHEEL_WEBHOOK_SECRET> or X-Manager-Isa-Webhook-Secret: <same value>
 *
 * @param {{ lastWebhookSource: string }} opts
 */
async function handleLionWheelTaskStatusWebhook(req, res, opts) {
  const { lastWebhookSource } = opts;
  const receivedAt = new Date().toISOString();
  const inbound = snapshotMakeWebhookRequest(req);
  let outcome = { httpStatus: 500, phase: 'unknown' };

  try {
    if (!MAKE_LIONWHEEL_WEBHOOK_SECRET) {
      outcome = { httpStatus: 503, phase: 'config', message: 'MAKE_LIONWHEEL_WEBHOOK_SECRET is not configured on server' };
      return res.status(503).json({ error: outcome.message });
    }
    const provided = lionWheelWebhookProvidedSecret(req);
    if (!provided || provided !== MAKE_LIONWHEEL_WEBHOOK_SECRET) {
      outcome = { httpStatus: 401, phase: 'auth', message: 'Unauthorized' };
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawBody = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    delete rawBody.secret;

    const fields = extractLionWheelWebhookFields(rawBody);
    if (!Number.isFinite(fields.taskStatusNum)) {
      outcome = {
        httpStatus: 400,
        phase: 'parse',
        message: 'Missing or unknown LionWheel status in payload',
        parsed: fields,
      };
      return res.status(400).json({ error: 'Missing or unknown LionWheel status in payload' });
    }

    const missions = await readMissions();
    let idx = -1;
    if (fields.taskId != null) {
      idx = missions.findIndex((m) => Number(m.lionwheel?.taskId) === Number(fields.taskId));
    }
    if (idx === -1 && fields.missionIdHint) {
      idx = missions.findIndex((m) => m.id === fields.missionIdHint);
    }

    let ordersList = null;
    let oidx = -1;
    if (idx === -1) {
      ordersList = await readOrders();
      if (fields.taskId != null) {
        oidx = ordersList.findIndex((o) => Number(o.lionwheel?.taskId) === Number(fields.taskId));
      }
      if (oidx === -1 && fields.missionIdHint) {
        oidx = ordersList.findIndex((o) => o.id === fields.missionIdHint);
      }
    }

    if (idx === -1 && oidx !== -1) {
      const prevOrder = ordersList[oidx];
      const prevLwOrder = prevOrder.lionwheel || {};
      const mergedOrder = {
        ...prevOrder,
        lionwheel: {
          ...prevLwOrder,
          ...(fields.taskId != null ? { taskId: fields.taskId } : {}),
          taskStatus: fields.taskStatusNum,
          taskStatusLabel: lionWheelTaskStatusLabel(fields.taskStatusNum),
          taskStatusFetchedAt: new Date().toISOString(),
          taskStatusFetchError: undefined,
          lastWebhookSource,
          lastWebhookAt: new Date().toISOString(),
        },
      };
      ordersList[oidx] = mergedOrder;
      await writeOrders(ordersList);
      outcome = {
        httpStatus: 200,
        phase: 'ok_order',
        orderId: mergedOrder.id,
        taskStatus: fields.taskStatusNum,
        parsed: fields,
      };
      return res.json({
        ok: true,
        id: fields.taskId,
        status: fields.taskStatusNum,
        orderId: mergedOrder.id,
        missionId: null,
        taskStatus: fields.taskStatusNum,
        taskStatusLabel: lionWheelTaskStatusLabel(fields.taskStatusNum),
        lionwheelTaskId: fields.taskId,
      });
    }

    if (idx === -1) {
      /** 200 so Make/Zapier-style queues stop retrying; mission/order may be missing on this env or test task. */
      outcome = {
        httpStatus: 200,
        phase: 'mission',
        message: 'Mission/order not found — webhook acknowledged, no DB update',
        parsed: fields,
        skipped: true,
      };
      return res.status(200).json({
        ok: true,
        acknowledged: true,
        skipped: 'mission_not_found',
        parsed: fields,
        taskId: fields.taskId,
        status: fields.taskStatusNum,
        taskStatusLabel: lionWheelTaskStatusLabel(fields.taskStatusNum),
      });
    }

    const prevMission = missions[idx];
    const prevLw = missions[idx].lionwheel || {};
    const merged = {
      ...missions[idx],
      lionwheel: {
        ...prevLw,
        /** Webhooks often arrive after create; persist LW task id whenever the payload includes it (was missing → UI had status but no LW ID). */
        ...(fields.taskId != null ? { taskId: fields.taskId } : {}),
        taskStatus: fields.taskStatusNum,
        taskStatusLabel: lionWheelTaskStatusLabel(fields.taskStatusNum),
        taskStatusFetchedAt: new Date().toISOString(),
        taskStatusFetchError: undefined,
        lastWebhookSource,
        lastWebhookAt: new Date().toISOString(),
      },
    };
    await creditAffiliateIfPickupJustCompletedLionWheel(prevMission, merged);
    await updateMissionsData(merged.id, merged);
    outcome = {
      httpStatus: 200,
      phase: 'ok',
      missionId: merged.id,
      taskStatus: fields.taskStatusNum,
      parsed: fields,
    };
    return res.json({
      ok: true,
      id: fields.taskId,
      status: fields.taskStatusNum,
      missionId: merged.id,
      taskStatus: fields.taskStatusNum,
      taskStatusLabel: lionWheelTaskStatusLabel(fields.taskStatusNum),
      lionwheelTaskId: fields.taskId,
    });
  } catch (err) {
    outcome = { httpStatus: 500, phase: 'exception', message: err.message };
    return res.status(500).json({ error: err.message });
  } finally {
    pushMakeWebhookInbound({ receivedAt, ...inbound, outcome });
  }
}

/** בלי אימות — לבדוק ש-Vercel מגיע ל-Express (אם אתה מקבל JSON הזה, הניתוב תקין). */
app.get('/api/webhooks/ping', (req, res) => {
  res.json({ ok: true, service: 'manager-isa', path: '/api/webhooks/ping' });
});

/** מממש שני נתיבי webhook; מעדיף lionwheel-task לגוף מלא מ-LionWheel. */
app.post('/api/webhooks/make-lionwheel-status', (req, res) =>
  handleLionWheelTaskStatusWebhook(req, res, { lastWebhookSource: 'make-lionwheel-status' }),
);

/**
 * Native LionWheel-style body: `{ task: { id, status, order_id, … }, trigger_field? }`.
 * מזקק מ-task.id + task.status (ו-fallback ל-task.order_id = mission id).
 */
app.post('/api/webhooks/lionwheel-task', (req, res) =>
  handleLionWheelTaskStatusWebhook(req, res, { lastWebhookSource: 'lionwheel-task' }),
);

/**
 * Debug only: receives any JSON body from Make (or another client), stores a full snapshot in memory, returns echo.
 * Does not update missions. Same Bearer as LionWheel unless MAKE_WEBHOOK_INSPECT_SECRET is set.
 *
 * URL for Make: POST {PUBLIC_BASE_URL}/api/webhooks/make-inspect
 * Header: Authorization: Bearer <secret>
 */
app.post('/api/webhooks/make-inspect', async (req, res) => {
  try {
    if (!MAKE_WEBHOOK_INSPECT_SECRET) {
      return res.status(503).json({ error: 'MAKE_WEBHOOK_INSPECT_SECRET / MAKE_LIONWHEEL_WEBHOOK_SECRET not configured' });
    }
    const provided = lionWheelWebhookProvidedSecret(req);
    if (!provided || provided !== MAKE_WEBHOOK_INSPECT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const snapshot = snapshotMakeWebhookRequest(req);
    const parsedFields = (() => {
      try {
        return extractLionWheelWebhookFields(
          req.body && typeof req.body === 'object' ? req.body : {},
        );
      } catch {
        return null;
      }
    })();

    const record = {
      snapshot,
      lionwheelParsePreview: parsedFields,
    };
    const { id, receivedAt } = pushMakeWebhookDebugCapture(record);

    return res.status(200).json({
      ok: true,
      message: 'Captured. Admins: GET /api/debug/make-webhook-inspect-log',
      receivedAt,
      id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Apply auth to all other /api routes ──────────────────────────────────────

app.use('/api', requireAuth);

app.get('/api/debug/make-webhook-inbound-log', requireAdmin, (req, res) => {
  try {
    res.json({ entries: getMakeWebhookInboundEntries() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debug/make-webhook-inbound-log', requireAdmin, (req, res) => {
  try {
    clearMakeWebhookInbound();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/make-webhook-inspect-log', requireAdmin, (req, res) => {
  try {
    res.json({ entries: getMakeWebhookDebugCaptures() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debug/make-webhook-inspect-log', requireAdmin, (req, res) => {
  try {
    clearMakeWebhookDebugCaptures();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const normalizeStatus = (s) => {
  if (s === 'recorded' || s === 'pending') return s === 'recorded' ? 'received' : 'linewhel_transferred';
  return s;
};

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await readOrders();
    const { status, type, createdBy, contacted, customerPhone } = req.query;
    let filtered = orders;
    if (status) filtered = filtered.filter((o) => o.status === status);
    if (type) filtered = filtered.filter((o) => o.type === type);
    if (createdBy) filtered = filtered.filter((o) => o.createdBy === createdBy);
    if (contacted === 'true') filtered = filtered.filter((o) => o.contacted === true);
    if (contacted === 'false') filtered = filtered.filter((o) => !o.contacted);
    if (customerPhone) {
      const qk = israeliMobileKey(customerPhone);
      filtered = filtered.filter(
        (o) => israeliMobileKey(o.customerPhone) === qk
      );
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/stats', async (req, res) => {
  try {
    const orders = await readOrders();
    const byStatus = {};
    const byType = {};
    const byCreatedBy = {};
    let totalBoxes = 0;
    let totalPrice = 0;
    let contactedCount = 0;
    let notContactedCount = 0;
    orders.forEach((o) => {
      const status = normalizeStatus(o.status);
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[o.type] = (byType[o.type] || 0) + 1;
      byCreatedBy[o.createdBy || 'unknown'] = (byCreatedBy[o.createdBy || 'unknown'] || 0) + 1;
      totalBoxes += o.boxes || 0;
      totalPrice += o.totalPrice || 0;
      if (o.contacted) contactedCount++;
      else notContactedCount++;
    });
    res.json({
      total: orders.length,
      totalBoxes,
      totalPrice,
      byStatus,
      byType,
      byCreatedBy,
      contacted: contactedCount,
      notContacted: notContactedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  const orders = await readOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', async (req, res) => {
  try {
    const orders = await readOrders();
    const body = req.body;
    const lwRegionFromBody =
      body.type === 'empty_box' || body.type === 'pickup'
        ? lwRegionFromCustomerBody(body.country, body.shippingDestination)
        : null;
    const newOrder = {
      ...body,
      id: body.id || `ORD-${Date.now()}`,
      status: body.status ?? (body.createdBy === 'customer' ? 'received' : 'linewhel_transferred'),
      createdAt: body.createdAt || new Date().toISOString(),
      customerPhone: body.customerPhone || '',
      scheduledFor: body.scheduledFor ?? null,
      assignedTo: body.assignedTo ?? null,
      readyAction: body.readyAction ?? null,
      createdBy: body.createdBy || 'customer',
      contacted: body.contacted ?? false,
      country: lwRegionFromBody ?? body.country ?? null,
      shippingDestination: null,
    };
    if (newOrder.type !== 'pickup') {
      newOrder.affiliateName = null;
      newOrder.affiliateSlug = null;
      newOrder.discountAmount = null;
      newOrder.promoCode = null;
    }
    orders.unshift(newOrder);
    await writeOrders(orders);

    let orderToReturn = newOrder;
    /** Same LionWheel create path as POST /api/missions for pickup / empty_box. */
    const shouldSyncLionWheel = newOrder.type === 'empty_box' || newOrder.type === 'pickup';
    if (shouldSyncLionWheel) {
      const missionLike = missionLikeFromOrderForLionWheel(newOrder);
      if (missionLike) {
        let missionForLw = missionLike;
        if (newOrder.type === 'pickup' && !lionWheelDestinationFromMission(missionLike)) {
          const missionsList = await readMissions();
          const fb = await pickupLionWheelDestinationFallback(missionLike, missionsList);
          if (fb) missionForLw = { ...missionLike, shippingDestination: fb };
        }
        try {
          const lw =
            newOrder.type === 'empty_box'
              ? await createLionWheelTaskForEmptyBoxMission(missionLike)
              : await createLionWheelTaskForPickupMission(missionForLw);
          if (!lw.skipped) {
            const lionwheel = lw.ok
              ? {
                  taskId: lw.taskId,
                  publicId: lw.publicId,
                  trackingLink: lw.trackingLink,
                  barcode: lw.barcode,
                  label: lw.label,
                  destinationRegionStr: lw.destinationRegionStr,
                  syncedAt: new Date().toISOString(),
                }
              : {
                  syncError: lw.error,
                  syncHttpStatus: lw.status,
                  syncAttemptedAt: new Date().toISOString(),
                };
            orderToReturn = { ...newOrder, lionwheel };
            const i = orders.findIndex((o) => o.id === newOrder.id);
            if (i !== -1) orders[i] = orderToReturn;
            await writeOrders(orders);
          }
        } catch (e) {
          const lionwheel = {
            syncError: e.message || String(e),
            syncAttemptedAt: new Date().toISOString(),
          };
          orderToReturn = { ...newOrder, lionwheel };
          const i = orders.findIndex((o) => o.id === newOrder.id);
          if (i !== -1) orders[i] = orderToReturn;
          await writeOrders(orders);
        }
      }
    }

    res.status(201).json(orderToReturn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    let merged = { ...orders[idx], ...req.body };
    if (merged.type !== 'pickup') {
      merged.affiliateName = null;
      merged.affiliateSlug = null;
      merged.discountAmount = null;
      merged.promoCode = null;
    }
    orders[idx] = merged;
    await writeOrders(orders);
    res.json(orders[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const orders = await readOrders();
  const filtered = orders.filter((o) => o.id !== req.params.id);
  if (filtered.length === orders.length) return res.status(404).json({ error: 'Order not found' });
  await writeOrders(filtered);
  res.json({ success: true });
});

const VALID_MISSION_TYPES = ['ready_for_box', 'ready_for_pickup'];
const VALID_STATUSES = ['received', 'linewhel_transferred', 'linewhel_scheduled', 'collected', 'shipped', 'completed'];

app.post('/api/orders/:id/missions', async (req, res) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    const { type, notes, status, addresses, customerDetails, pickupLocation, deliveryLocation, imageUrl, largeBoxes, smallBoxes } = req.body;
    if (!VALID_MISSION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid mission type' });
    }
    const mission = {
      id: `MSN-${Date.now()}`,
      type,
      status: VALID_STATUSES.includes(status) ? status : 'received',
      notes: notes || '',
      addresses: Array.isArray(addresses) ? addresses : [],
      customerDetails: customerDetails || null,
      pickupLocation: pickupLocation || null,
      deliveryLocation: deliveryLocation || null,
      imageUrl: imageUrl || null,
      largeBoxes: largeBoxes ?? null,
      smallBoxes: smallBoxes ?? null,
      createdAt: new Date().toISOString(),
    };
    const missions = Array.isArray(orders[idx].missions) ? orders[idx].missions : [];
    orders[idx] = { ...orders[idx], missions: [...missions, mission] };
    await writeOrders(orders);
    res.status(201).json(mission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/missions/:missionId', async (req, res) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    const missions = Array.isArray(orders[idx].missions) ? orders[idx].missions : [];
    const mIdx = missions.findIndex((m) => m.id === req.params.missionId);
    if (mIdx === -1) return res.status(404).json({ error: 'Mission not found' });
    const { type, status, notes, addresses, customerDetails, pickupLocation, deliveryLocation, imageUrl, largeBoxes, smallBoxes } = req.body;
    const updated = { ...missions[mIdx] };
    if (type && VALID_MISSION_TYPES.includes(type)) updated.type = type;
    if (status && VALID_STATUSES.includes(status)) updated.status = status;
    if (notes !== undefined) updated.notes = notes;
    if (addresses !== undefined) updated.addresses = Array.isArray(addresses) ? addresses : [];
    if (customerDetails !== undefined) updated.customerDetails = customerDetails;
    if (pickupLocation !== undefined) updated.pickupLocation = pickupLocation;
    if (deliveryLocation !== undefined) updated.deliveryLocation = deliveryLocation;
    if (imageUrl !== undefined) updated.imageUrl = imageUrl || null;
    if (largeBoxes !== undefined) updated.largeBoxes = largeBoxes ?? null;
    if (smallBoxes !== undefined) updated.smallBoxes = smallBoxes ?? null;
    missions[mIdx] = updated;
    orders[idx] = { ...orders[idx], missions };
    await writeOrders(orders);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id/missions/:missionId', async (req, res) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    const missions = Array.isArray(orders[idx].missions) ? orders[idx].missions : [];
    const filtered = missions.filter((m) => m.id !== req.params.missionId);
    if (filtered.length === missions.length) return res.status(404).json({ error: 'Mission not found' });
    orders[idx] = { ...orders[idx], missions: filtered };
    await writeOrders(orders);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Missions (top-level) ──────────────────────────────────────────────────────

const VALID_MISSION_TOP_TYPES = ['empty_box', 'pickup'];

app.get('/api/missions/stats', async (req, res) => {
  try {
    let missions = await readMissions();
    missions = await filterMissionsForCountryUser(missions, req.user);
    const byStatus = {};
    const byType = {};
    const byCreatedBy = {};
    let totalBoxes = 0;
    let missingAddress = 0;
    missions.forEach((m) => {
      const status = normalizeStatus(m.status);
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[m.type] = (byType[m.type] || 0) + 1;
      byCreatedBy[m.createdBy || 'unknown'] = (byCreatedBy[m.createdBy || 'unknown'] || 0) + 1;
      totalBoxes += (m.boxSelection?.large || 0) + (m.boxSelection?.small || 0);
      if (m.type === 'pickup' ? !m.receiverAddress?.lat : !m.address?.lat) missingAddress++;
    });
    res.json({ total: missions.length, totalBoxes, missingAddress, byStatus, byType, byCreatedBy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/missions', async (req, res) => {
  try {
    let missions = await readMissions();
    const forceLw =
      req.query.lionwheelSync === '1' ||
      req.query.lionwheelSync === 'true' ||
      req.query.lionwheelSync === '';
    await enrichMissionsWithLionWheelStatuses(missions, { force: forceLw });
    /** Re-read so LionWheel webhooks that landed during enrich are visible (per-row updates avoid clobbering them). */
    missions = await readMissions();
    missions = await filterMissionsForCountryUser(missions, req.user);
    const { status, type, createdBy, customerPhone, affiliate, linkedEmptyBoxMissionId, containerId } = req.query;
    let filtered = missions;
    if (status) filtered = filtered.filter((m) => m.status === status);
    if (type) filtered = filtered.filter((m) => m.type === type);
    if (createdBy) filtered = filtered.filter((m) => m.createdBy === createdBy);
    if (customerPhone) {
      const key = israeliMobileKey(customerPhone);
      filtered = filtered.filter((m) => israeliMobileKey(m.customerPhone) === key);
    }
    if (affiliate) filtered = filtered.filter((m) => m.affiliateName === affiliate);
    if (linkedEmptyBoxMissionId) filtered = filtered.filter((m) => m.linkedEmptyBoxMissionId === linkedEmptyBoxMissionId);
    if (containerId !== undefined) {
      if (containerId === '' || containerId === 'none') {
        filtered = filtered.filter((m) => !m.containerId);
      } else if (containerId) {
        filtered = filtered.filter((m) => m.containerId === containerId);
      }
    }
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/missions/:id', async (req, res) => {
  try {
    const missions = await readMissions();
    const mission = missions.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    await assertMissionAccessForCountryUser(mission, req.user);
    res.json(mission);
  } catch (err) {
    if (err.message === 'FORBIDDEN_MISSION') return res.status(404).json({ error: 'Mission not found' });
    res.status(500).json({ error: err.message });
  }
});

function maxPickupLinksForEmptyBox(emptyBoxMission) {
  if (!emptyBoxMission) return 1;
  const t = (emptyBoxMission.boxSelection?.large || 0) + (emptyBoxMission.boxSelection?.small || 0);
  return t > 0 ? t : 1;
}

app.patch('/api/missions/:id', async (req, res) => {
  try {
    const missions = await readMissions();
    const idx = missions.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Mission not found' });
    await assertMissionAccessForCountryUser(missions[idx], req.user);
    const updates = { ...req.body };
    if (updates.containerId !== undefined && missions[idx].type !== 'pickup') {
      updates.containerId = null;
    }
    const merged = { ...missions[idx], ...updates };
    if (merged.type === 'pickup') {
      merged.shippingDestination = null;
    } else if (merged.type === 'empty_box') {
      if (Object.prototype.hasOwnProperty.call(updates, 'country')) {
        const normC = userAuthCountryToShippingDestId(updates.country);
        merged.country = normC ?? updates.country ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'shippingDestination')) {
        const norm = normalizeShippingDestination('empty_box', updates.shippingDestination);
        if (norm != null) merged.country = norm;
      }
      const lwReg =
        userAuthCountryToShippingDestId(merged.country) ||
        normalizeShippingDestination('empty_box', merged.shippingDestination);
      if (lwReg) merged.country = lwReg;
      merged.shippingDestination = null;
    }
    if (merged.type !== 'pickup') {
      merged.affiliateName = null;
      merged.discountAmount = null;
    }
    if (merged.type === 'pickup' && merged.linkedEmptyBoxMissionId) {
      const ebId = merged.linkedEmptyBoxMissionId;
      const emptyBox = missions.find((m) => m.id === ebId && m.type === 'empty_box');
      if (!emptyBox) {
        return res.status(400).json({ error: 'Linked empty box mission not found' });
      }
      const maxLinks = maxPickupLinksForEmptyBox(emptyBox);
      const countAfter = missions.reduce((acc, m, i) => {
        const eff = i === idx ? merged : m;
        return acc + (eff.type === 'pickup' && eff.linkedEmptyBoxMissionId === ebId ? 1 : 0);
      }, 0);
      if (countAfter > maxLinks) {
        return res.status(400).json({
          error: `Maximum ${maxLinks} pickup link(s) allowed for this empty box (by box count).`,
        });
      }
    }
    const prevMission = missions[idx];
    missions[idx] = merged;
    await creditAffiliateIfPickupJustCompletedLionWheel(prevMission, merged);
    await updateMissionsData(merged.id, merged);
    res.json(merged);
  } catch (err) {
    if (err.message === 'FORBIDDEN_MISSION') return res.status(404).json({ error: 'Mission not found' });
    if (err.message === 'Mission not found') return res.status(404).json({ error: 'Mission not found' });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/missions/:id/send-to-lionwheel — manually send a customer mission to LionWheel ───

app.post('/api/missions/:id/send-to-lionwheel', requireAuth, async (req, res) => {
  try {
    const missions = await readMissions();
    const idx = missions.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Mission not found' });
    const mission = missions[idx];

    await assertMissionAccessForCountryUser(mission, req.user);

    if (!['pickup', 'empty_box'].includes(mission.type)) {
      return res.status(400).json({ error: 'Mission type must be pickup or empty_box' });
    }
    if (mission.lionwheel?.taskId) {
      return res.status(409).json({ error: 'Mission already sent to LionWheel', taskId: mission.lionwheel.taskId });
    }

    let missionForLw = mission;
    if (mission.type === 'pickup' && !lionWheelDestinationFromMission(mission)) {
      const fb = await pickupLionWheelDestinationFallback(mission, missions);
      if (fb) missionForLw = { ...mission, shippingDestination: fb };
    }

    let lw;
    try {
      lw = mission.type === 'empty_box'
        ? await createLionWheelTaskForEmptyBoxMission(mission)
        : await createLionWheelTaskForPickupMission(missionForLw);
    } catch (e) {
      const lionwheel = { syncError: e.message || String(e), syncAttemptedAt: new Date().toISOString() };
      const updated = { ...mission, lionwheel };
      missions[idx] = updated;
      await updateMissionsData(updated.id, updated);
      if (mission.type === 'empty_box') {
        notifyEmptyBoxMissionWebhook(updated).catch((wErr) =>
          console.warn('[MISSION_WEBHOOK_URL]', wErr.message || wErr),
        );
      }
      if (mission.type === 'pickup') {
        notifyEmptyBoxMissionWebhook(updated).catch((wErr) =>
          console.warn('[MISSION_WEBHOOK_URL pickup]', wErr.message || wErr),
        );
      }
      return res.status(502).json({ error: e.message, mission: updated });
    }

    /** Match POST /api/missions: do not persist lionwheel when credentials are missing (skipped). */
    if (lw.skipped) {
      return res.status(503).json({
        error: 'LionWheel credentials not configured',
        detail: lw.reason,
        mission,
      });
    }

    const lionwheel = lw.ok
      ? {
          taskId: lw.taskId,
          publicId: lw.publicId,
          trackingLink: lw.trackingLink,
          barcode: lw.barcode,
          label: lw.label,
          destinationRegionStr: lw.destinationRegionStr,
          syncedAt: new Date().toISOString(),
        }
      : {
          syncError: lw.error,
          syncHttpStatus: lw.status,
          syncAttemptedAt: new Date().toISOString(),
        };

    const updated = {
      ...mission,
      lionwheel,
    };
    missions[idx] = updated;
    await updateMissionsData(updated.id, updated);

    if (mission.type === 'empty_box') {
      notifyEmptyBoxMissionWebhook(updated).catch((wErr) =>
        console.warn('[MISSION_WEBHOOK_URL]', wErr.message || wErr),
      );
    }
    if (mission.type === 'pickup') {
      notifyEmptyBoxMissionWebhook(updated).catch((wErr) =>
        console.warn('[MISSION_WEBHOOK_URL pickup]', wErr.message || wErr),
      );
    }

    if (!lw.ok) {
      return res.status(502).json({ error: lw.error, lionwheel_status: lw.status, mission: updated });
    }

    return res.json({ success: true, mission: updated });
  } catch (err) {
    if (err.message === 'FORBIDDEN_MISSION') return res.status(404).json({ error: 'Mission not found' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/missions/:id', async (req, res) => {
  try {
    const missions = await readMissions();
    const mission = missions.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    await assertMissionAccessForCountryUser(mission, req.user);
    await deleteMissionsById(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'FORBIDDEN_MISSION') return res.status(404).json({ error: 'Mission not found' });
    if (err.message === 'Mission not found') return res.status(404).json({ error: 'Mission not found' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Containers ────────────────────────────────────────────────────────────────

const CONTAINER_STATUSES = [
  'in_storage_tlv',
  'in_transit',
  'in_customs_clearance',
  'door_to_door_in_progress',
];

function normalizeContainerStatusInput(bodyStatus) {
  if (bodyStatus === undefined || bodyStatus === null || bodyStatus === '') return 'in_storage_tlv';
  if (typeof bodyStatus !== 'string') return null;
  return CONTAINER_STATUSES.includes(bodyStatus) ? bodyStatus : null;
}

function parseEstimatedArrivalAt(bodyValue) {
  if (bodyValue === undefined || bodyValue === null || bodyValue === '') return null;
  if (typeof bodyValue !== 'string') return { error: 'estimatedArrivalAt must be a string or empty' };
  const d = new Date(bodyValue);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid estimatedArrivalAt' };
  return { iso: d.toISOString() };
}

app.get('/api/containers', async (req, res) => {
  try {
    let containers = await readContainers();
    if (req.user?.country && !req.user.isAdmin) {
      containers = containers.filter((c) => c.country === req.user.country);
    }
    res.json(containers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers', async (req, res) => {
  try {
    const containers = await readContainers();
    const body = req.body;
    const hasMaxPackages =
      body.maxPackages !== undefined && body.maxPackages !== null && String(body.maxPackages).trim() !== '';
    const maxPackages = hasMaxPackages ? Number(body.maxPackages) : 220;
    if (!(maxPackages > 0)) {
      return res.status(400).json({ error: 'maxPackages must be a positive number' });
    }
    const status = normalizeContainerStatusInput(body.status);
    if (status === null) {
      return res.status(400).json({
        error: `status must be one of: ${CONTAINER_STATUSES.join(', ')}`,
      });
    }
    const arrivalParsed = parseEstimatedArrivalAt(body.estimatedArrivalAt);
    if (arrivalParsed?.error) {
      return res.status(400).json({ error: arrivalParsed.error });
    }
    const wantDefault = Boolean(body.isDefault);
    const createdAt = body.createdAt || new Date().toISOString();
    const newContainer = {
      id: `CNT-${Date.now()}`,
      name: body.name || null,
      country: body.country || null,
      maxPackages,
      status,
      estimatedArrivalAt: arrivalParsed?.iso ?? null,
      isDefault: wantDefault,
      createdAt,
      statusTimestamps: { [status]: createdAt },
    };
    if (wantDefault) {
      const ck = containerCountryKey(newContainer.country);
      for (let i = 0; i < containers.length; i++) {
        if (containerCountryKey(containers[i].country) === ck) {
          containers[i] = { ...containers[i], isDefault: false };
        }
      }
    }
    containers.push(newContainer);
    await writeContainers(containers);
    res.status(201).json(newContainer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/containers/:id', async (req, res) => {
  try {
    const containers = await readContainers();
    const idx = containers.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Container not found' });
    const body = req.body;
    const updated = { ...containers[idx] };
    if (body.name !== undefined) updated.name = body.name || null;
    if (body.country !== undefined) updated.country = body.country || null;
    if (body.maxPackages !== undefined) {
      const v = Number(body.maxPackages);
      if (!(v > 0)) return res.status(400).json({ error: 'maxPackages must be a positive number' });
      updated.maxPackages = v;
    }
    if (body.status !== undefined) {
      const s = normalizeContainerStatusInput(body.status);
      if (s === null) {
        return res.status(400).json({
          error: `status must be one of: ${CONTAINER_STATUSES.join(', ')}`,
        });
      }
      const prevStatus = containers[idx].status ?? 'in_storage_tlv';
      if (s !== prevStatus) {
        const prevTs =
          containers[idx].statusTimestamps && typeof containers[idx].statusTimestamps === 'object'
            ? { ...containers[idx].statusTimestamps }
            : {};
        prevTs[s] = new Date().toISOString();
        updated.statusTimestamps = prevTs;
      }
      updated.status = s;
    }
    if (body.estimatedArrivalAt !== undefined) {
      const arrivalParsed = parseEstimatedArrivalAt(body.estimatedArrivalAt);
      if (arrivalParsed?.error) {
        return res.status(400).json({ error: arrivalParsed.error });
      }
      updated.estimatedArrivalAt = arrivalParsed?.iso ?? null;
    }
    if (body.isDefault !== undefined) {
      updated.isDefault = Boolean(body.isDefault);
    }
    delete updated.maxWeight;

    if (body.country !== undefined && updated.isDefault) {
      const countryKey = containerCountryKey(updated.country);
      for (let i = 0; i < containers.length; i++) {
        if (containers[i].id === req.params.id) continue;
        if (containerCountryKey(containers[i].country) === countryKey && containers[i].isDefault) {
          containers[i] = { ...containers[i], isDefault: false };
        }
      }
    }

    if (body.isDefault !== undefined && updated.isDefault) {
      const countryKey = containerCountryKey(updated.country);
      for (let i = 0; i < containers.length; i++) {
        containers[i] =
          containers[i].id === req.params.id
            ? { ...updated, isDefault: true }
            : containerCountryKey(containers[i].country) === countryKey
              ? { ...containers[i], isDefault: false }
              : containers[i];
      }
      await writeContainers(containers);
      res.json(containers.find((c) => c.id === req.params.id));
      return;
    }
    containers[idx] = updated;
    await writeContainers(containers);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/containers/:id', async (req, res) => {
  try {
    const containers = await readContainers();
    const idx = containers.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Container not found' });
    const containerId = containers[idx].id;
    const missions = await readMissions();
    const hasPackages = missions.some((m) => m.type === 'pickup' && m.containerId === containerId);
    if (hasPackages) {
      const updatedMissions = missions.map((m) =>
        m.type === 'pickup' && m.containerId === containerId ? { ...m, containerId: null } : m
      );
      await writeMissions(updatedMissions);
    }
    const filtered = containers.filter((c) => c.id !== req.params.id);
    await writeContainers(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Parcel Content Types ──────────────────────────────────────────────────────

function normalizeParcelTypeValueIls(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

app.get('/api/parcel-content-types', async (req, res) => {
  try {
    const types = await readParcelContentTypes();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/parcel-content-types', async (req, res) => {
  try {
    const types = await readParcelContentTypes();
    const { label, valueIls } = req.body;
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: 'label is required' });
    }
    const newType = {
      id: `pct-${Date.now()}`,
      label: String(label).trim(),
      valueIls: normalizeParcelTypeValueIls(valueIls),
    };
    types.push(newType);
    await writeParcelContentTypes(types);
    res.status(201).json(newType);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/parcel-content-types/:id', async (req, res) => {
  try {
    const types = await readParcelContentTypes();
    const idx = types.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Parcel content type not found' });
    const { label, valueIls } = req.body;
    const updated = { ...types[idx] };
    if (label !== undefined) updated.label = String(label).trim();
    if (valueIls !== undefined) updated.valueIls = normalizeParcelTypeValueIls(valueIls);
    types[idx] = updated;
    await writeParcelContentTypes(types);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/parcel-content-types/:id', async (req, res) => {
  try {
    const types = await readParcelContentTypes();
    const filtered = types.filter((t) => t.id !== req.params.id);
    if (filtered.length === types.length) return res.status(404).json({ error: 'Parcel content type not found' });
    await writeParcelContentTypes(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Affiliates ────────────────────────────────────────────────────────────────

app.get('/api/affiliates', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    res.json(affiliates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/affiliates', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    const { name, slug, promoCode, discountAmount, commissionPerOrder } = req.body;
    if (!name || !slug || !promoCode || discountAmount == null || commissionPerOrder == null) {
      return res.status(400).json({ error: 'name, slug, promoCode, discountAmount and commissionPerOrder are required' });
    }
    const slugExists = affiliates.some((a) => a.slug === slug.toLowerCase());
    const codeExists = affiliates.some((a) => a.promoCode.toUpperCase() === promoCode.toUpperCase());
    if (slugExists) return res.status(409).json({ error: 'Slug already exists' });
    if (codeExists) return res.status(409).json({ error: 'Promo code already exists' });

    const newAffiliate = {
      id: `AFF-${Date.now()}`,
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      promoCode: promoCode.toUpperCase().trim(),
      discountAmount: Number(discountAmount),
      commissionPerOrder: commissionPerOrder != null ? Number(commissionPerOrder) : null,
      active: true,
      orderCount: 0,
      createdAt: new Date().toISOString(),
    };
    affiliates.push(newAffiliate);
    await writeAffiliates(affiliates);
    res.status(201).json(newAffiliate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/affiliates/:id', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    const idx = affiliates.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Affiliate not found' });
    const { name, slug, promoCode, discountAmount, commissionPerOrder, active } = req.body;
    const updated = { ...affiliates[idx] };
    if (name !== undefined) updated.name = name.trim();
    if (slug !== undefined) {
      const conflict = affiliates.some((a, i) => i !== idx && a.slug === slug.toLowerCase());
      if (conflict) return res.status(409).json({ error: 'Slug already exists' });
      updated.slug = slug.toLowerCase().trim();
    }
    if (promoCode !== undefined) {
      const conflict = affiliates.some((a, i) => i !== idx && a.promoCode.toUpperCase() === promoCode.toUpperCase());
      if (conflict) return res.status(409).json({ error: 'Promo code already exists' });
      updated.promoCode = promoCode.toUpperCase().trim();
    }
    if (discountAmount !== undefined) updated.discountAmount = Number(discountAmount);
    if (commissionPerOrder !== undefined) updated.commissionPerOrder = commissionPerOrder != null ? Number(commissionPerOrder) : null;
    if (active !== undefined) updated.active = active;
    affiliates[idx] = updated;
    await writeAffiliates(affiliates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/affiliates/:id', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    const filtered = affiliates.filter((a) => a.id !== req.params.id);
    if (filtered.length === affiliates.length) return res.status(404).json({ error: 'Affiliate not found' });
    await writeAffiliates(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/affiliates/:id/customers/import', async (req, res) => {
  try {
    const affiliates = await readAffiliates();
    const idx = affiliates.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Affiliate not found' });

    const { customers } = req.body;
    if (!Array.isArray(customers)) return res.status(400).json({ error: 'customers must be an array' });

    const existing = affiliates[idx].importedCustomers || [];
    const merged = [...existing];

    for (const c of customers) {
      const cKey = israeliMobileKey(c.phone);
      if (!cKey) continue;
      const alreadyExists = merged.some((e) => israeliMobileKey(e.phone) === cKey);
      if (!alreadyExists) {
        merged.push({
          id: `IC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          firstName: (c.firstName || '').trim(),
          lastName: (c.lastName || '').trim(),
          phone: String(c.phone || '').trim(),
          importedAt: new Date().toISOString(),
        });
      }
    }

    affiliates[idx] = { ...affiliates[idx], importedCustomers: merged };
    await writeAffiliates(affiliates);
    res.json(affiliates[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Users ─────────────────────────────────────────────────── */

app.get('/api/users', async (req, res) => {
  try {
    const users = await readUsers();
    const q = (req.query.q || '').toLowerCase();
    const result = q
      ? users.filter((u) =>
          (u.fullName || '').toLowerCase().includes(q) ||
          israeliMobileKey(u.phone).includes(israeliMobileKey(q) || q.replace(/\D/g, ''))
        )
      : users;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const users = await readUsers();
    const body = req.body;
    const key = israeliMobileKey(body.phone);

    if (key) {
      const existingIdx = users.findIndex((u) => israeliMobileKey(u.phone) === key);
      if (existingIdx !== -1) {
        const updated = {
          ...users[existingIdx],
          fullName: body.fullName !== undefined ? body.fullName : users[existingIdx].fullName,
          address: body.address !== undefined ? body.address : users[existingIdx].address,
          notes: body.notes !== undefined ? body.notes : users[existingIdx].notes,
          ...(body.country !== undefined ? { country: userAuthCountryToShippingDestId(body.country) ?? null } : {}),
        };
        users[existingIdx] = updated;
        await writeUsers(users);
        return res.status(200).json(updated);
      }
    }

    const newUser = {
      id: `USR-${Date.now()}`,
      fullName: body.fullName || '',
      phone: body.phone || '',
      address: body.address || null,
      notes: body.notes || '',
      country: userAuthCountryToShippingDestId(body.country) ?? null,
      createdAt: new Date().toISOString(),
    };
    users.unshift(newUser);
    await writeUsers(users);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users[idx] = { ...users[idx], ...req.body };
    await writeUsers(users);
    res.json(users[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const users = await readUsers();
    const filtered = users.filter((u) => u.id !== req.params.id);
    await writeUsers(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Receivers (delivery recipients, lookup by phone, save on complete delivery) ─ */

app.get('/api/receivers', async (req, res) => {
  try {
    const receivers = await readReceivers();
    const q = (req.query.q || '').toLowerCase();
    const result = q
      ? receivers.filter((r) =>
          (r.fullName || '').toLowerCase().includes(q) ||
          (r.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        )
      : receivers;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/receivers/by-phone', async (req, res) => {
  try {
    const qDigits = (req.query.phone || '').replace(/\D/g, '');
    if (!qDigits || qDigits.length < 7) return res.json(null);
    const key = israeliMobileKey(req.query.phone);
    if (!key) return res.json(null);
    const receivers = await readReceivers();
    const match = receivers.find((r) => israeliMobileKey(r.phone) === key);
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/receivers', async (req, res) => {
  try {
    const receivers = await readReceivers();
    const body = req.body;
    const key = israeliMobileKey(body.phone);

    if (key) {
      const existingIdx = receivers.findIndex((r) => israeliMobileKey(r.phone) === key);
      if (existingIdx !== -1) {
        const updated = {
          ...receivers[existingIdx],
          fullName: body.fullName || receivers[existingIdx].fullName,
          address: body.address || receivers[existingIdx].address,
        };
        receivers[existingIdx] = updated;
        await writeReceivers(receivers);
        return res.status(200).json(updated);
      }
    }

    const newReceiver = {
      id: `RCV-${Date.now()}`,
      fullName: body.fullName || '',
      phone: body.phone || '',
      address: body.address || null,
      createdAt: new Date().toISOString(),
    };
    receivers.unshift(newReceiver);
    await writeReceivers(receivers);
    res.status(201).json(newReceiver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/receivers/:id', async (req, res) => {
  try {
    const receivers = await readReceivers();
    const idx = receivers.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Receiver not found' });
    receivers[idx] = { ...receivers[idx], ...req.body };
    await writeReceivers(receivers);
    res.json(receivers[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/receivers/:id', async (req, res) => {
  try {
    const receivers = await readReceivers();
    const filtered = receivers.filter((r) => r.id !== req.params.id);
    if (filtered.length === receivers.length) return res.status(404).json({ error: 'Receiver not found' });
    await writeReceivers(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
