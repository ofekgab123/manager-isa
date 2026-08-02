import crypto from 'crypto';
import { israeliMobileKey } from './phoneKey.js';

const GRAPH_API_VERSION = 'v21.0';

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
