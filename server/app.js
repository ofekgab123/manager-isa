import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { readOrders, writeOrders, readAffiliates, writeAffiliates, readMissions, writeMissions, readUsers, writeUsers, readContainers, writeContainers, readParcelContentTypes, writeParcelContentTypes } from './storage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'isa-manager-jwt-secret-key';

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      'https://isa-psi-six.vercel.app',
      'https://isa-32uqdb92z-ofekgab123s-projects.vercel.app',
      'https://isa-git-main-ofekgab123s-projects.vercel.app',
      'http://localhost:5173',
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
      { id: user.id, username: user.username, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, isAdmin: user.is_admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, isAdmin: req.user.isAdmin });
});

// ─── Auth users CRUD (admin only) ─────────────────────────────────────────────

app.get('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, created_at FROM auth_users ORDER BY created_at ASC'
    );
    res.json(rows.map((r) => ({ id: r.id, username: r.username, isAdmin: r.is_admin, createdAt: r.created_at })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const hash = await bcrypt.hash(password, 10);
    const id = `AU-${Date.now()}`;
    await pool.query(
      'INSERT INTO auth_users (id, username, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
      [id, username.trim(), hash, !!isAdmin]
    );
    res.status(201).json({ id, username: username.trim(), isAdmin: !!isAdmin });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    const { rows } = await pool.query('SELECT * FROM auth_users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (username !== undefined) { updates.push(`username = $${idx++}`); values.push(username.trim()); }
    if (password)               { updates.push(`password_hash = $${idx++}`); values.push(await bcrypt.hash(password, 10)); }
    if (isAdmin !== undefined)  { updates.push(`is_admin = $${idx++}`); values.push(!!isAdmin); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);
    await pool.query(`UPDATE auth_users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    const { rows: updated } = await pool.query(
      'SELECT id, username, is_admin, created_at FROM auth_users WHERE id = $1', [req.params.id]
    );
    const u = updated[0];
    res.json({ id: u.id, username: u.username, isAdmin: u.is_admin, createdAt: u.created_at });
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
    const missions = await readMissions();
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
    const missions = await readMissions();
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

app.post('/api/missions', async (req, res) => {
  try {
    const missions = await readMissions();
    const body = req.body;
    const newMission = {
      id: `MSN-${Date.now()}`,
      type: VALID_MISSION_TOP_TYPES.includes(body.type) ? body.type : 'pickup',
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
      notes: body.notes || body.orderNotes || null,
      affiliateName: body.affiliateName || null,
      discountAmount: body.discountAmount || null,
      linkedEmptyBoxMissionId: body.linkedEmptyBoxMissionId || null,
      containerId: body.type === 'pickup' ? (body.containerId || null) : null,
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

app.patch('/api/missions/:id', async (req, res) => {
  try {
    const missions = await readMissions();
    const idx = missions.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Mission not found' });
    const updates = { ...req.body };
    if (updates.containerId !== undefined && missions[idx].type !== 'pickup') {
      updates.containerId = null;
    }
    missions[idx] = { ...missions[idx], ...updates };
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

app.get('/api/containers', async (req, res) => {
  try {
    const containers = await readContainers();
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
    const newContainer = {
      id: `CNT-${Date.now()}`,
      name: body.name || null,
      country: body.country || null,
      maxWeight,
      maxPackages,
      createdAt: body.createdAt || new Date().toISOString(),
    };
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

export default app;
