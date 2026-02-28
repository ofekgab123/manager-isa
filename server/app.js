import express from 'express';
import cors from 'cors';
import { readOrders, writeOrders } from './storage.js';

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
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

export default app;
