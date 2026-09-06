import crypto from 'crypto';
import { israeliMobileKey } from './phoneKey.js';

const GRAPH_API_VERSION = 'v21.0';

/** Meta template names: lowercase letters, digits, underscores. */
export function normalizeWaTemplateName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** E.164 digits only for Meta API (e.g. 972559640862). */
export function whatsAppRecipientDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const key = israeliMobileKey(phone);
  if (key.length === 9) return `972${key}`;
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return `972${d.slice(1)}`;
  return d;
}

export function verifyWebhookSignature(rawBody, signatureHeader, appSecret) {
  const secret = (appSecret || '').trim();
  if (!secret || !signatureHeader || !rawBody) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

function wabaAuth() {
  const wabaId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!wabaId || !accessToken) {
    throw new Error('WhatsApp Business Account is not configured (WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_ACCESS_TOKEN)');
  }
  return { wabaId, accessToken };
}

function graphErrorMessage(data) {
  return data?.error?.message || JSON.stringify(data).slice(0, 300);
}

export function extractBodyPlaceholders(text) {
  const nums = [...new Set(
    [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])),
  )].sort((a, b) => a - b);
  return nums;
}

export function toMetaBodyText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return '';
  const named = [...raw.matchAll(/\{\{([^}]+)\}\}/g)];
  if (named.length === 0) return raw;
  const allNumeric = named.every((m) => /^\d+$/.test(String(m[1]).trim()));
  if (allNumeric) return raw;
  let i = 0;
  return raw.replace(/\{\{([^}]+)\}\}/g, () => `{{${++i}}}`);
}

export function buildTemplateComponents({ headerText, bodyText, footerText, exampleValues = [] }) {
  const components = [];
  const header = String(headerText || '').trim();
  if (header) {
    components.push({ type: 'HEADER', format: 'TEXT', text: header });
  }
  const body = {
    type: 'BODY',
    text: toMetaBodyText(bodyText),
  };
  const placeholders = extractBodyPlaceholders(body.text);
  if (placeholders.length > 0) {
    const examples = placeholders.map((_, i) => {
      const v = String(exampleValues[i] ?? '').trim();
      return v || (i === 0 ? 'David' : `example${i + 1}`);
    });
    body.example = { body_text: [examples] };
  }
  components.push(body);
  const footer = String(footerText || '').trim();
  if (footer) {
    components.push({ type: 'FOOTER', text: footer });
  }
  return components;
}

/** All WABA templates (any status). */
export async function fetchWabaMessageTemplates() {
  const wabaId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!wabaId || !accessToken) return [];

  const fields = 'name,status,language,category,components,rejected_reason,id';
  let url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?limit=100&fields=${fields}`;
  const out = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`WhatsApp templates API error: ${graphErrorMessage(data)}`);
    }
    for (const tpl of data.data || []) out.push(tpl);
    url = data.paging?.next || null;
  }

  return out;
}

/** Approved templates from Meta WABA (message_templates API). */
export async function fetchApprovedMessageTemplates() {
  const all = await fetchWabaMessageTemplates();
  return all.filter((tpl) => tpl.status === 'APPROVED');
}

export async function submitWabaMessageTemplate({
  name,
  language = 'en',
  category = 'UTILITY',
  headerText,
  bodyText,
  footerText,
  exampleValues = [],
}) {
  const { wabaId, accessToken } = wabaAuth();
  const waName = normalizeWaTemplateName(name);
  if (!waName) throw new Error('Template name is required');
  const body = toMetaBodyText(bodyText);
  if (!body.trim()) throw new Error('Template body is required');

  const payload = {
    name: waName,
    language,
    category,
    components: buildTemplateComponents({ headerText, bodyText: body, footerText, exampleValues }),
    allow_category_change: true,
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp template submit error: ${graphErrorMessage(data)}`);
  }
  return {
    id: data.id || null,
    status: data.status || 'PENDING',
    category: data.category || category,
    name: waName,
    language,
  };
}

export async function updateWabaMessageTemplate(metaId, {
  category,
  headerText,
  bodyText,
  footerText,
  exampleValues = [],
}) {
  const { accessToken } = wabaAuth();
  if (!metaId) throw new Error('Meta template id is required');
  const body = toMetaBodyText(bodyText);
  if (!body.trim()) throw new Error('Template body is required');

  const payload = {
    components: buildTemplateComponents({ headerText, bodyText: body, footerText, exampleValues }),
  };
  if (category) payload.category = category;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${metaId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp template update error: ${graphErrorMessage(data)}`);
  }
  return {
    id: data.id || metaId,
    status: data.status || null,
    category: data.category || category || null,
  };
}

/** Send an approved WhatsApp template message via Meta Cloud API. */
export async function sendTemplateMessage({
  to,
  templateName,
  language = 'en',
  variables = [],
}) {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp API not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
  }

  const recipient = whatsAppRecipientDigits(to);
  if (!recipient) throw new Error('Invalid recipient phone');

  const components =
    variables.length > 0
      ? [
          {
            type: 'body',
            parameters: variables.map((text) => ({
              type: 'text',
              text: String(text ?? ''),
            })),
          },
        ]
      : undefined;

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(components ? { components } : {}),
    },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`WhatsApp API error: ${msg}`);
  }

  return {
    waMessageId: data.messages?.[0]?.id || null,
    recipient,
    raw: data,
  };
}

/** Free-form text within the 24h customer service window. */
export async function sendTextMessage({ to, text }) {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp API not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)');
  }

  const body = String(text || '').trim();
  if (!body) throw new Error('Message text is required');

  const recipient = whatsAppRecipientDigits(to);
  if (!recipient) throw new Error('Invalid recipient phone');

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'text',
    text: { body },
  };

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);
    throw new Error(`WhatsApp API error: ${msg}`);
  }

  return {
    waMessageId: data.messages?.[0]?.id || null,
    recipient,
    raw: data,
  };
}
