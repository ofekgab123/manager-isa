import {
  readLeads,
  insertLeadData,
  updateLeadData,
  deleteLeadById,
  findLeadByPhoneKey,
  readMessageTemplates,
  insertMessageTemplateData,
  updateMessageTemplateData,
  readMessagesForLead,
  insertMessageData,
  updateMessageByWaMessageId,
} from './storage.js';
import { israeliMobileKey } from './phoneKey.js';
import {
  sendTemplateMessage,
  sendTextMessage,
  verifyWebhookSignature,
  fetchApprovedMessageTemplates,
} from './whatsapp.js';

export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'converted'];

const CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function conversationWindowOpenUntilFromInbound(at) {
  return new Date(new Date(at).getTime() + CONVERSATION_WINDOW_MS).toISOString();
}

export function isConversationWindowOpen(lead) {
  if (!lead?.conversationWindowOpenUntil) return false;
  return new Date(lead.conversationWindowOpenUntil) > new Date();
}

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
const WHATSAPP_APP_SECRET = (process.env.WHATSAPP_APP_SECRET || '').trim();

function buildLeadRecord({ phone, fullName = '', status = 'new', notes = '', source = 'manual' }) {
  const phoneKey = israeliMobileKey(phone);
  if (!phoneKey || phoneKey.length < 7) throw new Error('Invalid phone number');
  const now = new Date().toISOString();
  return {
    id: `LED-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    phone: String(phone).trim(),
    phoneKey,
    fullName: String(fullName || '').trim(),
    status: LEAD_STATUSES.includes(status) ? status : 'new',
    notes: String(notes || '').trim(),
    source,
    createdAt: now,
    updatedAt: now,
    lastContactedAt: null,
    lastContactedBy: null,
    lastInboundAt: null,
    conversationWindowOpenUntil: null,
  };
}

function templateVariablesForLead(template, lead) {
  const vars = Array.isArray(template.variables) ? template.variables : [];
  return vars.map((key) => {
    if (key === 'fullName') return lead.fullName?.trim() || 'there';
    if (key === 'phone') return lead.phone || '';
    return lead[key] != null ? String(lead[key]) : '';
  });
}

function previewBody(template, lead) {
  const vars = templateVariablesForLead(template, lead);
  let body = template.bodyPreview || '';
  vars.forEach((v, i) => {
    body = body.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
    body = body.replace(new RegExp(`\\{\\{${template.variables?.[i] || i}\\}\\}`, 'g'), v);
  });
  return body;
}

function templateKey(t) {
  return `${t.waTemplateName}:${t.language || 'en'}`;
}

function metaTemplateToRecord(meta) {
  const bodyComp = meta.components?.find((c) => c.type === 'BODY');
  const headerComp = meta.components?.find((c) => c.type === 'HEADER' && c.format === 'TEXT');
  const parts = [];
  if (headerComp?.text) parts.push(headerComp.text);
  if (bodyComp?.text) parts.push(bodyComp.text);
  const bodyPreview = parts.join('\n').trim();
  const varCount = (bodyComp?.text?.match(/\{\{\d+\}\}/g) || []).length;
  const variables =
    varCount > 0
      ? Array.from({ length: varCount }, (_, i) => (i === 0 ? 'fullName' : `var${i + 1}`))
      : [];
  const language = meta.language || 'en';
  return {
    id: `WA-${meta.name}-${language}`,
    name: meta.name,
    waTemplateName: meta.name,
    language,
    variables,
    bodyPreview,
    isActive: true,
    source: 'meta',
    category: meta.category || null,
  };
}

/** Meta-approved templates merged with local DB overrides (same name + language). */
async function getMergedTemplates({ activeOnly = false } = {}) {
  const local = await readMessageTemplates();
  let metaApproved = [];
  try {
    metaApproved = await fetchApprovedMessageTemplates();
  } catch (err) {
    console.error('Failed to fetch Meta templates:', err.message);
  }

  const byKey = new Map();
  for (const meta of metaApproved) {
    const rec = metaTemplateToRecord(meta);
    byKey.set(templateKey(rec), rec);
  }
  for (const tpl of local) {
    byKey.set(templateKey(tpl), tpl);
  }

  let merged = [...byKey.values()];
  if (activeOnly) merged = merged.filter((t) => t.isActive !== false);
  merged.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return merged;
}

/** Register WhatsApp webhook routes — must be called BEFORE app.use('/api', requireAuth). */
export function registerWhatsAppWebhook(app) {
  app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  });

  app.post('/api/webhooks/whatsapp', async (req, res) => {
    try {
      const rawBody = req.webhookRawBodyUtf8;
      const signature = req.headers['x-hub-signature-256'];
      if (WHATSAPP_APP_SECRET && rawBody) {
        if (!verifyWebhookSignature(rawBody, signature, WHATSAPP_APP_SECRET)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const body = req.body;
      if (body?.object !== 'whatsapp_business_account') {
        return res.sendStatus(200);
      }

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;

          if (value.statuses) {
            for (const st of value.statuses) {
              const waMessageId = st.id;
              const status = st.status;
              const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
              const patch = { status };
              if (status === 'delivered') patch.deliveredAt = ts;
              if (status === 'read') patch.readAt = ts;
              if (status === 'failed') patch.failedAt = ts;
              await updateMessageByWaMessageId(waMessageId, patch);
            }
          }

          if (value.messages) {
            for (const msg of value.messages) {
              const from = msg.from;
              const phoneKey = israeliMobileKey(from);
              if (!phoneKey) continue;

              let lead = await findLeadByPhoneKey(phoneKey);
              if (!lead) {
                const created = buildLeadRecord({ phone: from, source: 'whatsapp_inbound' });
                await insertLeadData(created.id, created);
                lead = created;
              }

              const inboundBody =
                msg.type === 'text'
                  ? msg.text?.body || ''
                  : `[${msg.type || 'message'}]`;

              const now = new Date().toISOString();
              const msgId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await insertMessageData(msgId, {
                id: msgId,
                leadId: lead.id,
                phone: lead.phone,
                direction: 'inbound',
                templateId: null,
                waTemplateName: null,
                body: inboundBody,
                waMessageId: msg.id || null,
                status: 'replied',
                sentBy: null,
                sentAt: now,
                deliveredAt: now,
                readAt: null,
                repliedAt: now,
                inboundBody,
              });

              const windowUntil = conversationWindowOpenUntilFromInbound(now);
              await updateLeadData(lead.id, {
                ...lead,
                status: lead.status === 'new' ? 'contacted' : lead.status,
                lastInboundAt: now,
                conversationWindowOpenUntil: windowUntil,
                updatedAt: now,
              });
            }
          }
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error('WhatsApp webhook error:', err);
      return res.sendStatus(200);
    }
  });
}

/** Register authenticated leads + templates routes — call AFTER app.use('/api', requireAuth). */
export function registerLeadsRoutes(app, { requireAdmin }) {
  app.get('/api/leads', async (req, res) => {
    try {
      let leads = await readLeads();
      const { status, q } = req.query;
      if (status) leads = leads.filter((l) => l.status === status);
      if (q) {
        const query = String(q).toLowerCase();
        leads = leads.filter(
          (l) =>
            (l.phone || '').toLowerCase().includes(query) ||
            (l.fullName || '').toLowerCase().includes(query) ||
            (l.phoneKey || '').includes(israeliMobileKey(q)),
        );
      }
      res.json(leads);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads', async (req, res) => {
    try {
      const leads = await readLeads();
      const lead = buildLeadRecord(req.body);
      if (leads.some((l) => l.phoneKey === lead.phoneKey)) {
        return res.status(409).json({ error: 'Lead with this phone already exists' });
      }
      await insertLeadData(lead.id, lead);
      res.status(201).json(lead);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/leads/import', async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.leads) ? req.body.leads : req.body?.phones;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Expected { leads: [{ phone, fullName? }] }' });
      }
      const existing = await readLeads();
      const keys = new Set(existing.map((l) => l.phoneKey));
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        const phone = typeof row === 'string' ? row : row?.phone;
        if (!phone) continue;
        try {
          const lead = buildLeadRecord({
            phone,
            fullName: typeof row === 'object' ? row.fullName : '',
            source: 'import',
          });
          if (keys.has(lead.phoneKey)) {
            skipped++;
            continue;
          }
          await insertLeadData(lead.id, lead);
          keys.add(lead.phoneKey);
          imported++;
        } catch {
          skipped++;
        }
      }
      res.json({ imported, skipped, total: (await readLeads()).length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/leads/:id', async (req, res) => {
    try {
      const leads = await readLeads();
      const idx = leads.findIndex((l) => l.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Lead not found' });
      const prev = leads[idx];
      const body = req.body || {};
      const next = {
        ...prev,
        ...(body.fullName != null ? { fullName: String(body.fullName).trim() } : {}),
        ...(body.notes != null ? { notes: String(body.notes).trim() } : {}),
        ...(body.status != null && LEAD_STATUSES.includes(body.status) ? { status: body.status } : {}),
        updatedAt: new Date().toISOString(),
      };
      await updateLeadData(prev.id, next);
      res.json(next);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/leads/:id', async (req, res) => {
    try {
      await deleteLeadById(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/leads/:id/messages', async (req, res) => {
    try {
      const leads = await readLeads();
      const lead = leads.find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      const messages = await readMessagesForLead(req.params.id);
      res.json({
        messages,
        conversationWindowOpen: isConversationWindowOpen(lead),
        conversationWindowOpenUntil: lead.conversationWindowOpenUntil || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/:id/send-message', async (req, res) => {
    try {
      const { templateId } = req.body || {};
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      const leads = await readLeads();
      const lead = leads.find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      const templates = await getMergedTemplates({ activeOnly: true });
      const template = templates.find((t) => t.id === templateId);
      if (!template) return res.status(404).json({ error: 'Template not found or inactive' });

      const variables = templateVariablesForLead(template, lead);
      const bodyPreview = previewBody(template, lead);

      const result = await sendTemplateMessage({
        to: lead.phone,
        templateName: template.waTemplateName,
        language: template.language || 'en',
        variables,
      });

      const now = new Date().toISOString();
      const msgId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const message = {
        id: msgId,
        leadId: lead.id,
        phone: lead.phone,
        direction: 'outbound',
        messageType: 'template',
        templateId: template.id,
        waTemplateName: template.waTemplateName,
        body: bodyPreview,
        waMessageId: result.waMessageId,
        status: 'sent',
        sentBy: req.user?.id || req.user?.username || null,
        sentAt: now,
        deliveredAt: null,
        readAt: null,
        repliedAt: null,
        inboundBody: null,
      };
      await insertMessageData(msgId, message);

      const updatedLead = {
        ...lead,
        status: lead.status === 'new' ? 'contacted' : lead.status,
        lastContactedAt: now,
        lastContactedBy: req.user?.id || req.user?.username || null,
        updatedAt: now,
      };
      await updateLeadData(lead.id, updatedLead);

      res.json({ message, lead: updatedLead });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/:id/send-text', async (req, res) => {
    try {
      const { text } = req.body || {};
      const body = String(text || '').trim();
      if (!body) return res.status(400).json({ error: 'text is required' });

      const leads = await readLeads();
      const lead = leads.find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      if (!isConversationWindowOpen(lead)) {
        return res.status(400).json({
          error: 'Conversation window closed. Send an approved template to start or re-open the conversation.',
          conversationWindowOpen: false,
        });
      }

      const result = await sendTextMessage({ to: lead.phone, text: body });

      const now = new Date().toISOString();
      const msgId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const message = {
        id: msgId,
        leadId: lead.id,
        phone: lead.phone,
        direction: 'outbound',
        messageType: 'text',
        templateId: null,
        waTemplateName: null,
        body,
        waMessageId: result.waMessageId,
        status: 'sent',
        sentBy: req.user?.id || req.user?.username || null,
        sentAt: now,
        deliveredAt: null,
        readAt: null,
        repliedAt: null,
        inboundBody: null,
      };
      await insertMessageData(msgId, message);

      const updatedLead = {
        ...lead,
        lastContactedAt: now,
        lastContactedBy: req.user?.id || req.user?.username || null,
        updatedAt: now,
      };
      await updateLeadData(lead.id, updatedLead);

      res.json({
        message,
        lead: updatedLead,
        conversationWindowOpen: isConversationWindowOpen(updatedLead),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/message-templates', async (req, res) => {
    try {
      const activeOnly = req.query.active !== '0';
      res.json(await getMergedTemplates({ activeOnly }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/message-templates', requireAdmin, async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name?.trim() || !body.waTemplateName?.trim()) {
        return res.status(400).json({ error: 'name and waTemplateName are required' });
      }
      const tpl = {
        id: `TPL-${Date.now()}`,
        name: body.name.trim(),
        waTemplateName: body.waTemplateName.trim(),
        language: body.language || 'en',
        variables: Array.isArray(body.variables) ? body.variables : ['fullName'],
        bodyPreview: body.bodyPreview || '',
        isActive: body.isActive !== false,
        createdAt: new Date().toISOString(),
      };
      await insertMessageTemplateData(tpl.id, tpl);
      res.status(201).json(tpl);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/message-templates/:id', requireAdmin, async (req, res) => {
    try {
      const templates = await readMessageTemplates();
      const prev = templates.find((t) => t.id === req.params.id);
      if (!prev) return res.status(404).json({ error: 'Template not found' });
      const body = req.body || {};
      const next = {
        ...prev,
        ...(body.name != null ? { name: String(body.name).trim() } : {}),
        ...(body.waTemplateName != null ? { waTemplateName: String(body.waTemplateName).trim() } : {}),
        ...(body.language != null ? { language: body.language } : {}),
        ...(body.variables != null ? { variables: body.variables } : {}),
        ...(body.bodyPreview != null ? { bodyPreview: body.bodyPreview } : {}),
        ...(body.isActive != null ? { isActive: !!body.isActive } : {}),
      };
      await updateMessageTemplateData(prev.id, next);
      res.json(next);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
