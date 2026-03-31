import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { readOrders, writeOrders, readAffiliates, writeAffiliates, readMissions, writeMissions, readUsers, writeUsers, readReceivers, writeReceivers, readContainers, writeContainers, readParcelContentTypes, writeParcelContentTypes } from './storage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'isa-manager-jwt-secret-key';

const app = express();

// DB migration: add country column to auth_users if it doesn't exist
pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS country VARCHAR(50)`).catch(() => {});
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
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
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  // Allow unauthenticated POST /api/missions for customer form submissions (from isa-psi-six)
  if (req.method === 'POST' && req.path === '/api/missions') {
    const createdBy = req.body?.createdBy ?? 'customer';
    if (createdBy === 'customer') return next();
  }
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
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
    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 7) return res.json(null);
    const users = await readUsers();
    const match = users.find((u) => (u.phone || '').replace(/\D/g, '') === phone);
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Public: POST /api/missions (no auth - for customer-facing forms) ──────────

app.post('/api/missions', async (req, res) => {
  try {
    const missions = await readMissions();
    const body = req.body;
    const validTypes = ['empty_box', 'pickup'];
    const missionType = validTypes.includes(body.type) ? body.type : 'pickup';
    let pickupContainerId = null;
    if (missionType === 'pickup') {
      if (Object.prototype.hasOwnProperty.call(body, 'containerId')) {
        pickupContainerId = body.containerId || null;
      } else {
        const containersList = await readContainers();
        const def = containersList.find((c) => c.isDefault);
        pickupContainerId = def ? def.id : null;
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
      affiliateName: body.affiliateName || null,
      discountAmount: body.discountAmount || null,
      linkedEmptyBoxMissionId: body.linkedEmptyBoxMissionId || null,
      containerId: missionType === 'pickup' ? pickupContainerId : null,
    };
    missions.unshift(newMission);
    await writeMissions(missions);

    if (body.affiliateName) {
      try {
        const affiliates = await readAffiliates();
        const idx = affiliates.findIndex((a) => a.name === body.affiliateName);
        if (idx !== -1) {
          affiliates[idx] = { ...affiliates[idx], orderCount: (affiliates[idx].orderCount || 0) + 1 };
          await writeAffiliates(affiliates);
        }
      } catch {}
    }

    res.status(201).json(newMission);
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
        container = {
          id: c.id,
          name: c.name,
          status: c.status,
          estimatedArrivalAt: c.estimatedArrivalAt,
          country: c.country,
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

// ─── Apply auth to all other /api routes ──────────────────────────────────────

app.use('/api', requireAuth);

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
      const phone = customerPhone.replace(/\D/g, '');
      filtered = filtered.filter((o) => (o.customerPhone || '').replace(/\D/g, '') === phone);
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
    };
    orders.unshift(newOrder);
    await writeOrders(orders);

    // Increment affiliate orderCount when order is associated with an affiliate
    if (body.affiliateName) {
      try {
        const affiliates = await readAffiliates();
        const idx = affiliates.findIndex((a) => a.name === body.affiliateName);
        if (idx !== -1) {
          affiliates[idx] = { ...affiliates[idx], orderCount: (affiliates[idx].orderCount || 0) + 1 };
          await writeAffiliates(affiliates);
        }
      } catch {}
    }

    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    orders[idx] = { ...orders[idx], ...req.body };
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
    if (req.user?.country) {
      const containers = await readContainers();
      const ids = new Set(containers.filter((c) => c.country === req.user.country).map((c) => c.id));
      missions = missions.filter((m) => m.containerId && ids.has(m.containerId));
    }
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
    if (req.user?.country) {
      const containers = await readContainers();
      const ids = new Set(containers.filter((c) => c.country === req.user.country).map((c) => c.id));
      missions = missions.filter((m) => m.containerId && ids.has(m.containerId));
    }
    const { status, type, createdBy, customerPhone, affiliate, linkedEmptyBoxMissionId, containerId } = req.query;
    let filtered = missions;
    if (status) filtered = filtered.filter((m) => m.status === status);
    if (type) filtered = filtered.filter((m) => m.type === type);
    if (createdBy) filtered = filtered.filter((m) => m.createdBy === createdBy);
    if (customerPhone) {
      const phone = customerPhone.replace(/\D/g, '');
      filtered = filtered.filter((m) => (m.customerPhone || '').replace(/\D/g, '') === phone);
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
    res.json(mission);
  } catch (err) {
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
    const updates = { ...req.body };
    if (updates.containerId !== undefined && missions[idx].type !== 'pickup') {
      updates.containerId = null;
    }
    const merged = { ...missions[idx], ...updates };
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
    missions[idx] = merged;
    await writeMissions(missions);
    res.json(missions[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/missions/:id', async (req, res) => {
  try {
    const missions = await readMissions();
    const filtered = missions.filter((m) => m.id !== req.params.id);
    if (filtered.length === missions.length) return res.status(404).json({ error: 'Mission not found' });
    await writeMissions(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Containers ────────────────────────────────────────────────────────────────

const CONTAINER_STATUSES = ['open', 'closed', 'in_transit', 'completed'];

function normalizeContainerStatusInput(bodyStatus) {
  if (bodyStatus === undefined || bodyStatus === null || bodyStatus === '') return 'open';
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
    if (req.user?.country) {
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
    const maxWeight = Number(body.maxWeight);
    const maxPackages = Number(body.maxPackages);
    if (!(maxWeight > 0) || !(maxPackages > 0)) {
      return res.status(400).json({ error: 'maxWeight and maxPackages must be positive numbers' });
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
    const newContainer = {
      id: `CNT-${Date.now()}`,
      name: body.name || null,
      country: body.country || null,
      maxWeight,
      maxPackages,
      status,
      estimatedArrivalAt: arrivalParsed?.iso ?? null,
      isDefault: wantDefault,
      createdAt: body.createdAt || new Date().toISOString(),
    };
    if (wantDefault) {
      for (let i = 0; i < containers.length; i++) {
        containers[i] = { ...containers[i], isDefault: false };
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
    if (body.maxWeight !== undefined) {
      const v = Number(body.maxWeight);
      if (!(v > 0)) return res.status(400).json({ error: 'maxWeight must be a positive number' });
      updated.maxWeight = v;
    }
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
      if (updated.isDefault) {
        for (let i = 0; i < containers.length; i++) {
          containers[i] =
            containers[i].id === req.params.id
              ? updated
              : { ...containers[i], isDefault: false };
        }
        await writeContainers(containers);
        res.json(containers.find((c) => c.id === req.params.id));
        return;
      }
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
    const { label } = req.body;
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: 'label is required' });
    }
    const newType = {
      id: `pct-${Date.now()}`,
      label: String(label).trim(),
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
    const { label } = req.body;
    const updated = { ...types[idx] };
    if (label !== undefined) updated.label = String(label).trim();
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
      const phone = (String(c.phone || '')).replace(/\D/g, '');
      if (!phone) continue;
      const alreadyExists = merged.some((e) => (String(e.phone || '')).replace(/\D/g, '') === phone);
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

// ─── Promo code validation ──────────────────────────────────────────────────────

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

/* ─── Users ─────────────────────────────────────────────────── */

app.get('/api/users', async (req, res) => {
  try {
    const users = await readUsers();
    const q = (req.query.q || '').toLowerCase();
    const result = q
      ? users.filter((u) =>
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
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
    const normalizedPhone = (body.phone || '').replace(/\D/g, '');

    if (normalizedPhone) {
      const existingIdx = users.findIndex(
        (u) => (u.phone || '').replace(/\D/g, '') === normalizedPhone
      );
      if (existingIdx !== -1) {
        const updated = {
          ...users[existingIdx],
          fullName: body.fullName || users[existingIdx].fullName,
          address: body.address || users[existingIdx].address,
          notes: body.notes || users[existingIdx].notes,
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
    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 7) return res.json(null);
    const receivers = await readReceivers();
    const match = receivers.find((r) => (r.phone || '').replace(/\D/g, '') === phone);
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/receivers', async (req, res) => {
  try {
    const receivers = await readReceivers();
    const body = req.body;
    const normalizedPhone = (body.phone || '').replace(/\D/g, '');

    if (normalizedPhone) {
      const existingIdx = receivers.findIndex(
        (r) => (r.phone || '').replace(/\D/g, '') === normalizedPhone
      );
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
