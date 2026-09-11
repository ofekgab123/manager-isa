import {
  readLeads,
  insertLeadData,
  insertLeadsData,
  updateLeadData,
  deleteLeadById,
  deleteLeadsByIds,
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
  fetchWabaMessageTemplates,
  submitWabaMessageTemplate,
  updateWabaMessageTemplate,
  normalizeWaTemplateName,
  toMetaBodyText,
  extractBodyPlaceholders,
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

function normalizeLeadCountry(country) {
  const value = String(country || '').trim().toLowerCase();
  if (value === 'th' || value === 'thailand') return 'thailand';
  if (value === 'in' || value === 'india') return 'india';
  return null;
}

function buildLeadRecord({
  phone,
  firstName = '',
  lastName = '',
  fullName = '',
  status = 'new',
  notes = '',
  source = 'manual',
  country = null,
}) {
  const phoneKey = israeliMobileKey(phone);
  if (!phoneKey || phoneKey.length < 7) throw new Error('Invalid phone number');
  const now = new Date().toISOString();
  return {
    id: `LED-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    phone: String(phone).trim(),
    phoneKey,
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    fullName: String(fullName || '').trim(),
    status: LEAD_STATUSES.includes(status) ? status : 'new',
    notes: String(notes || '').trim(),
    source,
    country: normalizeLeadCountry(country),
    createdAt: now,
    updatedAt: now,
    lastContactedAt: null,
    lastContactedBy: null,
    lastInboundAt: null,
    lastInboundPreview: null,
    conversationWindowOpenUntil: null,
  };
}

function templateVariablesForLead(template, lead) {
  const vars = Array.isArray(template.variables) ? template.variables : [];
  const defaults = Array.isArray(template.variableDefaults) ? template.variableDefaults : [];
  return vars.map((key, i) => {
    if (key === 'fullName') return lead.fullName?.trim() || 'there';
    if (key === 'phone') return lead.phone || defaults[i] || '';
    const fromLead = lead[key] != null ? String(lead[key]).trim() : '';
    if (fromLead) return fromLead;
    return defaults[i] || '';
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

function placeholderCount(text) {
  return (String(text || '').match(/\{\{\d+\}\}/g) || []).length;
}

async function loadApprovedMetaTemplates() {
  try {
    return await fetchApprovedMessageTemplates();
  } catch (err) {
    console.error('Failed to fetch Meta templates:', err.message);
    return null;
  }
}

async function loadAllMetaTemplates() {
  try {
    return await fetchWabaMessageTemplates();
  } catch (err) {
    console.error('Failed to fetch Meta templates:', err.message);
    return null;
  }
}

function findMetaTemplate(allMeta, name, language) {
  const requested = normalizeWaTemplateName(name);
  const matches = (allMeta || []).filter((m) => normalizeWaTemplateName(m.name) === requested);
  return matches.find((m) => m.language === (language || 'en')) || matches[0] || null;
}

function variablesFromBody(text, fallback = []) {
  const named = [...String(text || '').matchAll(/\{\{([^}]+)\}\}/g)].map((m) => String(m[1]).trim());
  if (named.length === 0) return Array.isArray(fallback) ? fallback : [];
  return named.map((n, i) => {
    if (/^\d+$/.test(n)) return fallback[i] || (i === 0 ? 'fullName' : `var${i + 1}`);
    return n;
  });
}

function normalizeTemplatePayload(body, prev = {}) {
  const displayName = String(body.name ?? prev.name ?? '').trim();
  const waTemplateName =
    normalizeWaTemplateName(body.waTemplateName ?? prev.waTemplateName ?? displayName) ||
    String(body.waTemplateName ?? prev.waTemplateName ?? '').trim();
  const bodyPreview = String(body.bodyPreview ?? prev.bodyPreview ?? '');
  const fallbackVars = Array.isArray(body.variables)
    ? body.variables
    : Array.isArray(prev.variables)
      ? prev.variables
      : [];
  const variables = variablesFromBody(bodyPreview, fallbackVars);
  const exampleValues = Array.isArray(body.exampleValues)
    ? body.exampleValues
    : Array.isArray(body.variableDefaults)
      ? body.variableDefaults
      : Array.isArray(prev.exampleValues)
        ? prev.exampleValues
        : Array.isArray(prev.variableDefaults)
          ? prev.variableDefaults
          : [];
  return {
    name: displayName,
    waTemplateName,
    language: body.language ?? prev.language ?? 'en',
    category: body.category ?? prev.category ?? 'UTILITY',
    headerText: String(body.headerText ?? prev.headerText ?? '').trim(),
    footerText: String(body.footerText ?? prev.footerText ?? '').trim(),
    bodyPreview,
    variables,
    variableDefaults: exampleValues,
    exampleValues,
    isActive: body.isActive != null ? !!body.isActive : prev.isActive !== false,
  };
}

/** Align a stored/UI template with the approved Meta name, language, and variable count. */
function resolveTemplateForSend(template, metaApproved) {
  const requested = normalizeWaTemplateName(template.waTemplateName || template.name);
  const matches = Array.isArray(metaApproved)
    ? metaApproved.filter((m) => normalizeWaTemplateName(m.name) === requested)
    : [];
  const meta =
    matches.find((m) => m.language === (template.language || 'en')) || matches[0] || null;
  const metaRec = meta ? metaTemplateToRecord(meta) : null;
  const expectedVars = metaRec ? metaRec.variables.length : placeholderCount(template.bodyPreview);
  let mapped =
    expectedVars === 0
      ? []
      : Array.isArray(template.variables) && template.variables.length
        ? template.variables.slice(0, expectedVars)
        : metaRec?.variables || [];
  while (mapped.length < expectedVars) {
    mapped = [...mapped, metaRec?.variables?.[mapped.length] || `var${mapped.length + 1}`];
  }
  return {
    ...template,
    waTemplateName: meta?.name || requested,
    language: meta?.language || template.language || 'en',
    variables: mapped,
    variableDefaults: template.variableDefaults || metaRec?.variableDefaults || [],
    bodyPreview: template.bodyPreview || metaRec?.bodyPreview || '',
    metaApproved: !!meta,
  };
}

async function sendTemplateToLead(lead, template, sentBy, metaApproved) {
  const resolved =
    template.waTemplateName && template.metaApproved != null && Array.isArray(template.variables)
      ? template
      : resolveTemplateForSend(template, metaApproved || []);
  if (Array.isArray(metaApproved) && metaApproved.length > 0 && !resolved.metaApproved) {
    throw new Error(
      `WhatsApp template "${template.waTemplateName || template.name}" is not approved on this account. Use the exact Meta name (lowercase_with_underscores), e.g. new_customer_no_answer.`,
    );
  }

  const variables = templateVariablesForLead(resolved, lead);
  const bodyPreview = previewBody(resolved, lead);
  const missingIdx = variables.findIndex((v) => !String(v ?? '').trim());
  if (missingIdx >= 0) {
    const varName = resolved.variables?.[missingIdx] || `#${missingIdx + 1}`;
    throw new Error(
      `Template parameter "${varName}" is empty. Fill the lead field or set a default in Leads → Templates.`,
    );
  }

  const result = await sendTemplateMessage({
    to: lead.phone,
    templateName: resolved.waTemplateName,
    language: resolved.language || 'en',
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
    templateId: resolved.id,
    waTemplateName: resolved.waTemplateName,
    body: bodyPreview,
    waMessageId: result.waMessageId,
    status: 'sent',
    sentBy,
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
    lastContactedBy: sentBy,
    updatedAt: now,
  };
  await updateLeadData(lead.id, updatedLead);

  return { message, lead: updatedLead };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function metaTemplateToRecord(meta) {
  const bodyComp = meta.components?.find((c) => c.type === 'BODY');
  const headerComp = meta.components?.find((c) => c.type === 'HEADER' && c.format === 'TEXT');
  const footerComp = meta.components?.find((c) => c.type === 'FOOTER');
  const bodyText = bodyComp?.text || '';
  const headerText = headerComp?.text || '';
  const footerText = footerComp?.text || '';
  const bodyPreview = bodyText;
  const varCount = extractBodyPlaceholders(bodyText).length;
  const exampleValues = bodyComp?.example?.body_text?.[0] || [];
  const variables =
    varCount > 0
      ? Array.from({ length: varCount }, (_, i) => (i === 0 ? 'fullName' : `var${i + 1}`))
      : [];
  const variableDefaults = Array.from({ length: varCount }, (_, i) => exampleValues[i] || '');
  const language = meta.language || 'en';
  const status = String(meta.status || '').toUpperCase();
  return {
    id: `WA-${meta.name}-${language}`,
    name: meta.name,
    waTemplateName: meta.name,
    language,
    variables,
    variableDefaults,
    exampleValues: variableDefaults,
    headerText,
    footerText,
    bodyPreview,
    isActive: true,
    source: 'meta',
    category: meta.category || null,
    metaId: meta.id || null,
    metaStatus: status || 'UNKNOWN',
    metaApproved: status === 'APPROVED',
    rejectedReason: cleanRejectedReason(meta.rejected_reason),
  };
}

function cleanRejectedReason(reason) {
  const text = String(reason || '').trim();
  if (!text || /^none$/i.test(text)) return null;
  return text;
}

function attachMetaStatus(record, anyMeta, fallback = {}) {
  const status = String(
    anyMeta?.status || fallback.metaStatus || (record.metaApproved ? 'APPROVED' : 'LOCAL'),
  ).toUpperCase();
  return {
    ...record,
    metaId: anyMeta?.id || fallback.metaId || record.metaId || null,
    metaStatus: status,
    metaApproved: status === 'APPROVED',
    rejectedReason:
      cleanRejectedReason(anyMeta?.rejected_reason) ||
      cleanRejectedReason(fallback.rejectedReason) ||
      cleanRejectedReason(record.rejectedReason),
    category: record.category || anyMeta?.category || fallback.category || null,
    headerText: record.headerText || fallback.headerText || '',
    footerText: record.footerText || fallback.footerText || '',
    exampleValues: record.exampleValues || record.variableDefaults || fallback.exampleValues || [],
  };
}

/** Meta templates (all statuses) merged with local DB overrides (same name + language). */
async function getMergedTemplates({ activeOnly = false } = {}) {
  const local = await readMessageTemplates();
  const allMeta = await loadAllMetaTemplates();
  const metaList = allMeta || [];
  const approved = metaList.filter((m) => m.status === 'APPROVED');

  const byKey = new Map();
  for (const tpl of local) {
    const resolved = resolveTemplateForSend(tpl, approved);
    const key = `${normalizeWaTemplateName(resolved.waTemplateName)}:${resolved.language}`;
    if (allMeta === null) {
      const storedStatus = String(tpl.metaStatus || (tpl.metaApproved ? 'APPROVED' : 'LOCAL')).toUpperCase();
      byKey.set(key, {
        ...resolved,
        id: tpl.id,
        name: tpl.name || resolved.waTemplateName,
        isActive: tpl.isActive !== false,
        source: tpl.source || 'local',
        metaId: tpl.metaId || null,
        metaStatus: storedStatus,
        metaApproved: storedStatus === 'APPROVED' || tpl.metaApproved === true,
        rejectedReason: tpl.rejectedReason || null,
        category: tpl.category || resolved.category || null,
        headerText: tpl.headerText || '',
        footerText: tpl.footerText || '',
        exampleValues: tpl.exampleValues || tpl.variableDefaults || [],
      });
      continue;
    }
    const anyMeta = findMetaTemplate(metaList, resolved.waTemplateName, resolved.language);
    const withStatus = attachMetaStatus(resolved, anyMeta, tpl);
    byKey.set(key, {
      ...withStatus,
      id: tpl.id,
      name: tpl.name || resolved.waTemplateName,
      isActive: tpl.isActive !== false,
      source: anyMeta || withStatus.metaStatus !== 'LOCAL' ? 'local+meta' : tpl.source || 'local',
    });
  }
  for (const meta of metaList) {
    const rec = metaTemplateToRecord(meta);
    const key = `${normalizeWaTemplateName(rec.waTemplateName)}:${rec.language}`;
    if (byKey.has(key)) continue;
    byKey.set(key, rec);
  }

  let merged = [...byKey.values()];
  if (activeOnly) merged = merged.filter((t) => t.isActive !== false);
  merged.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return merged;
}

async function applyTemplateStatusUpdate(value) {
  const name = value?.message_template_name;
  const language = value?.message_template_language;
  const event = String(value?.event || '').toUpperCase();
  const metaId = value?.message_template_id;
  if (!name && !metaId) return;
  const templates = await readMessageTemplates();
  for (const tpl of templates) {
    const matchName = name && normalizeWaTemplateName(tpl.waTemplateName) === normalizeWaTemplateName(name);
    const matchLang = !language || tpl.language === language;
    const matchId = metaId && String(tpl.metaId || '') === String(metaId);
    if (!((matchName && matchLang) || matchId)) continue;
    await updateMessageTemplateData(tpl.id, {
      ...tpl,
      metaId: metaId || tpl.metaId || null,
      metaStatus: event || tpl.metaStatus,
      metaApproved: event === 'APPROVED',
      rejectedReason: cleanRejectedReason(value.reason || value.rejected_reason) || tpl.rejectedReason || null,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function leadNeedsReply(lead) {
  if (!lead?.lastInboundAt) return false;
  if (!lead.lastContactedAt) return true;
  return new Date(lead.lastInboundAt) > new Date(lead.lastContactedAt);
}

function inboundMessageText(msg) {
  const type = msg?.type;
  if (type === 'text') return String(msg.text?.body || '').trim();
  if (type === 'button') {
    return String(msg.button?.text || msg.button?.payload || '').trim();
  }
  if (type === 'interactive') {
    const reply = msg.interactive || {};
    if (reply.button_reply) {
      return String(reply.button_reply.title || reply.button_reply.id || '').trim();
    }
    if (reply.list_reply) {
      return String(reply.list_reply.title || reply.list_reply.id || '').trim();
    }
    if (reply.nfm_reply?.response_json) {
      return String(reply.nfm_reply.response_json).trim();
    }
  }
  const caption =
    msg?.image?.caption ||
    msg?.video?.caption ||
    msg?.document?.caption ||
    msg?.document?.filename;
  if (caption) return String(caption).trim();
  if (type === 'location') {
    const loc = msg.location || {};
    return [loc.name, loc.address].filter(Boolean).join(', ') || '[location]';
  }
  if (type === 'reaction' && msg.reaction?.emoji) return String(msg.reaction.emoji).trim();
  return String(msg?.text?.body || '').trim() || `[${type || 'message'}]`;
}

function enrichLeadForList(lead) {
  const needsReply = leadNeedsReply(lead);
  return {
    ...lead,
    needsReply,
    alertText: needsReply
      ? lead.lastInboundPreview?.trim()
        ? `New message: ${lead.lastInboundPreview.trim()}`
        : 'New message — awaiting reply'
      : null,
  };
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

          if (change.field === 'message_template_status_update') {
            await applyTemplateStatusUpdate(value);
          }

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

              const inboundBody = inboundMessageText(msg);

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
                lastInboundPreview: inboundBody.slice(0, 200),
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
  function canAccessLeads(user) {
    return !!user;
  }

  function leadCountryForRequest(req) {
    if (!req.user?.isAdmin) return normalizeLeadCountry(req.user?.country);
    return normalizeLeadCountry(req.body?.country);
  }

  function leadVisibleToUser(lead, user) {
    if (user?.isAdmin) return true;
    const userCountry = normalizeLeadCountry(user?.country);
    if (!userCountry) return false;
    const leadCountry = normalizeLeadCountry(lead?.country);
    // Leads created before country scoping belonged to the original India-only view.
    return leadCountry ? leadCountry === userCountry : userCountry === 'india';
  }

  function visibleLeadsForUser(leads, user) {
    return leads.filter((lead) => leadVisibleToUser(lead, user));
  }

  function requireLeadsAccess(req, res, next) {
    if (canAccessLeads(req.user)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  }

  app.get('/api/leads', requireLeadsAccess, async (req, res) => {
    try {
      let leads = await readLeads();
      leads = visibleLeadsForUser(leads, req.user);
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
      leads.sort((a, b) => {
        const aAlert = leadNeedsReply(a) ? 1 : 0;
        const bAlert = leadNeedsReply(b) ? 1 : 0;
        if (aAlert !== bAlert) return bAlert - aAlert;
        const aT = a.lastInboundAt || a.updatedAt || '';
        const bT = b.lastInboundAt || b.updatedAt || '';
        return bT.localeCompare(aT);
      });
      res.json(leads.map(enrichLeadForList));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads', requireLeadsAccess, async (req, res) => {
    try {
      const leads = await readLeads();
      const lead = buildLeadRecord({ ...req.body, country: leadCountryForRequest(req) });
      if (visibleLeadsForUser(leads, req.user).some((l) => l.phoneKey === lead.phoneKey)) {
        return res.status(409).json({ error: 'Lead with this phone already exists' });
      }
      await insertLeadData(lead.id, lead);
      res.status(201).json(lead);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/leads/import', requireLeadsAccess, async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.leads) ? req.body.leads : req.body?.phones;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Expected { leads: [{ phone, fullName? }] }' });
      }
      const allLeads = await readLeads();
      const existing = visibleLeadsForUser(allLeads, req.user);
      const country = leadCountryForRequest(req);
      const keys = new Set(existing.map((l) => l.phoneKey));
      const leadsToInsert = [];
      let skipped = 0;
      for (const row of rows) {
        const phone = typeof row === 'string' ? row : row?.phone;
        const phoneText = String(phone ?? '').trim().replace(/^['"]|['"]$/g, '');
        if (!phoneText || /^(null|#null!|undefined|n\/a|na|none|-)$/i.test(phoneText)) continue;
        try {
          const lead = buildLeadRecord({
            phone,
            firstName: typeof row === 'object' ? row.firstName : '',
            lastName: typeof row === 'object' ? row.lastName : '',
            fullName: typeof row === 'object' ? row.fullName : '',
            notes: typeof row === 'object' ? row.notes : '',
            source: 'import',
            country,
          });
          if (keys.has(lead.phoneKey)) {
            skipped++;
            continue;
          }
          keys.add(lead.phoneKey);
          leadsToInsert.push(lead);
        } catch {
          skipped++;
        }
      }
      await insertLeadsData(leadsToInsert);
      res.json({
        imported: leadsToInsert.length,
        skipped,
        total: existing.length + leadsToInsert.length,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/leads/:id', requireLeadsAccess, async (req, res) => {
    try {
      const leads = await readLeads();
      const idx = leads.findIndex(
        (l) => l.id === req.params.id && leadVisibleToUser(l, req.user),
      );
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

  app.delete('/api/leads/:id', requireLeadsAccess, async (req, res) => {
    try {
      const leads = await readLeads();
      const lead = leads.find(
        (item) => item.id === req.params.id && leadVisibleToUser(item, req.user),
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      await deleteLeadById(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/leads/bulk-delete', requireLeadsAccess, async (req, res) => {
    try {
      const { leadIds } = req.body || {};
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds array is required' });
      }
      if (leadIds.length > 1000) {
        return res.status(400).json({ error: 'Maximum 1000 leads per delete' });
      }
      const leads = await readLeads();
      const allowedIds = new Set(
        visibleLeadsForUser(leads, req.user).map((lead) => lead.id),
      );
      const visibleIds = leadIds.filter((id) => allowedIds.has(id));
      const result = await deleteLeadsByIds(visibleIds);
      res.json({ ok: true, deleted: result.deleted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/leads/:id/messages', requireLeadsAccess, async (req, res) => {
    try {
      const leads = await readLeads();
      const lead = leads.find(
        (l) => l.id === req.params.id && leadVisibleToUser(l, req.user),
      );
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

  app.post('/api/leads/:id/send-message', requireLeadsAccess, async (req, res) => {
    try {
      const { templateId } = req.body || {};
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      const leads = await readLeads();
      const lead = leads.find(
        (l) => l.id === req.params.id && leadVisibleToUser(l, req.user),
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      const templates = await getMergedTemplates({ activeOnly: true });
      const template = templates.find((t) => t.id === templateId);
      if (!template) return res.status(404).json({ error: 'Template not found or inactive' });

      const sentBy = req.user?.id || req.user?.username || null;
      const metaApproved = (await loadApprovedMetaTemplates()) || [];
      const result = await sendTemplateToLead(lead, template, sentBy, metaApproved);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/bulk-send-message', requireLeadsAccess, async (req, res) => {
    try {
      const { templateId, leadIds } = req.body || {};
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds array is required' });
      }
      if (leadIds.length > 1000) {
        return res.status(400).json({ error: 'Maximum 1000 leads per bulk send' });
      }

      const leads = visibleLeadsForUser(await readLeads(), req.user);
      const templates = await getMergedTemplates({ activeOnly: true });
      const template = templates.find((t) => t.id === templateId);
      if (!template) return res.status(404).json({ error: 'Template not found or inactive' });

      const metaApproved = (await loadApprovedMetaTemplates()) || [];
      const resolved = resolveTemplateForSend(template, metaApproved);
      if (metaApproved.length > 0 && !resolved.metaApproved) {
        return res.status(400).json({
          error: `WhatsApp template "${template.waTemplateName || template.name}" is not approved on this account. Use the exact Meta name (lowercase_with_underscores), e.g. new_customer_no_answer.`,
        });
      }

      const sentBy = req.user?.id || req.user?.username || null;
      const results = [];
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < leadIds.length; i++) {
        const leadId = leadIds[i];
        const lead = leads.find((l) => l.id === leadId);
        if (!lead) {
          results.push({ leadId, ok: false, error: 'Lead not found' });
          failed++;
          continue;
        }
        try {
          const out = await sendTemplateToLead(lead, resolved, sentBy, metaApproved);
          results.push({
            leadId,
            ok: true,
            phone: lead.phone,
            fullName: lead.fullName || null,
            lead: out.lead,
          });
          sent++;
        } catch (err) {
          results.push({
            leadId,
            ok: false,
            phone: lead.phone,
            fullName: lead.fullName || null,
            error: err.message,
          });
          failed++;
        }
        if (i < leadIds.length - 1) await sleep(350);
      }

      res.json({ sent, failed, total: leadIds.length, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/:id/send-text', requireLeadsAccess, async (req, res) => {
    try {
      const { text } = req.body || {};
      const body = String(text || '').trim();
      if (!body) return res.status(400).json({ error: 'text is required' });

      const leads = await readLeads();
      const lead = leads.find(
        (l) => l.id === req.params.id && leadVisibleToUser(l, req.user),
      );
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

  app.get('/api/message-templates', requireLeadsAccess, async (req, res) => {
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
      const fields = normalizeTemplatePayload(body);
      if (!fields.name || !fields.waTemplateName) {
        return res.status(400).json({ error: 'name and waTemplateName are required' });
      }
      if (body.submitToMeta && !fields.bodyPreview.trim()) {
        return res.status(400).json({ error: 'Template body is required to submit to Meta' });
      }

      let metaResult = null;
      if (body.submitToMeta) {
        metaResult = await submitWabaMessageTemplate({
          name: fields.waTemplateName,
          language: fields.language,
          category: fields.category,
          headerText: fields.headerText,
          bodyText: toMetaBodyText(fields.bodyPreview),
          footerText: fields.footerText,
          exampleValues: fields.exampleValues,
        });
      }

      const tpl = {
        id: `TPL-${Date.now()}`,
        ...fields,
        metaId: metaResult?.id || null,
        metaStatus: metaResult?.status || 'LOCAL',
        metaApproved: metaResult?.status === 'APPROVED',
        rejectedReason: null,
        source: metaResult ? 'local+meta' : 'local',
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
      let prev = templates.find((t) => t.id === req.params.id);
      const body = req.body || {};
      const fields = normalizeTemplatePayload(body, prev || {});
      if (!fields.name || !fields.waTemplateName) {
        return res.status(400).json({ error: 'name and waTemplateName are required' });
      }
      if (body.submitToMeta && !fields.bodyPreview.trim()) {
        return res.status(400).json({ error: 'Template body is required to submit to Meta' });
      }

      if (!prev && !String(req.params.id || '').startsWith('WA-')) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const existingMetaId = prev?.metaId || body.metaId || null;
      let metaResult = null;
      if (body.submitToMeta) {
        if (existingMetaId) {
          metaResult = await updateWabaMessageTemplate(existingMetaId, {
            category: fields.category,
            headerText: fields.headerText,
            bodyText: toMetaBodyText(fields.bodyPreview),
            footerText: fields.footerText,
            exampleValues: fields.exampleValues,
          });
        } else {
          metaResult = await submitWabaMessageTemplate({
            name: fields.waTemplateName,
            language: fields.language,
            category: fields.category,
            headerText: fields.headerText,
            bodyText: toMetaBodyText(fields.bodyPreview),
            footerText: fields.footerText,
            exampleValues: fields.exampleValues,
          });
        }
      }

      const next = {
        ...(prev || {}),
        id: prev?.id || `TPL-${Date.now()}`,
        ...fields,
        metaId: metaResult?.id || existingMetaId || prev?.metaId || null,
        metaStatus: metaResult?.status || prev?.metaStatus || (existingMetaId ? 'PENDING' : 'LOCAL'),
        metaApproved: (metaResult?.status || prev?.metaStatus) === 'APPROVED',
        rejectedReason: prev?.rejectedReason || null,
        source: (metaResult?.id || existingMetaId) ? 'local+meta' : prev?.source || 'local',
        createdAt: prev?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (metaResult?.status) {
        next.metaStatus = metaResult.status;
        next.metaApproved = metaResult.status === 'APPROVED';
      }

      if (prev) {
        await updateMessageTemplateData(prev.id, next);
      } else {
        await insertMessageTemplateData(next.id, next);
      }
      res.json(next);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
