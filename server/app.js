import express from 'express';
import cors from 'cors';
import { readOrders, writeOrders, readAffiliates, writeAffiliates, readMissions, writeMissions, readUsers, writeUsers } from './storage.js';

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
    const { status, type, createdBy, customerPhone } = req.query;
    let filtered = missions;
    if (status) filtered = filtered.filter((m) => m.status === status);
    if (type) filtered = filtered.filter((m) => m.type === type);
    if (createdBy) filtered = filtered.filter((m) => m.createdBy === createdBy);
    if (customerPhone) {
      const phone = customerPhone.replace(/\D/g, '');
      filtered = filtered.filter((m) => (m.customerPhone || '').replace(/\D/g, '') === phone);
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
      customerPhone: body.customerPhone || '',
      address: body.address || null,
      boxSelection: body.boxSelection || { large: 0, small: 0 },
      bringBoxes: body.bringBoxes !== undefined ? body.bringBoxes : true,
      notes: body.notes || null,
    };
    missions.unshift(newMission);
    await writeMissions(missions);
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
    missions[idx] = { ...missions[idx], ...req.body };
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
    const { name, slug, promoCode, discountAmount } = req.body;
    if (!name || !slug || !promoCode || discountAmount == null) {
      return res.status(400).json({ error: 'name, slug, promoCode and discountAmount are required' });
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
    const { name, slug, promoCode, discountAmount, active } = req.body;
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
