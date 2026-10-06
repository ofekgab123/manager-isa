function cleanText(value, max = 2048) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * First-touch fields from a WhatsApp Cloud API inbound message.
 * Existing non-empty values on the lead are kept.
 */
export function whatsAppFirstTouch(lead, msg, metadata) {
  const referral = msg?.referral && typeof msg.referral === 'object' ? msg.referral : {};
  const incoming = {
    channel: 'whatsapp',
    ctwaClid: cleanText(referral.ctwa_clid),
    waSourceId: cleanText(referral.source_id),
    waSourceType: cleanText(referral.source_type),
    waSourceUrl: cleanText(referral.source_url),
    waHeadline: cleanText(referral.headline),
    businessPhone: cleanText(metadata?.display_phone_number, 32),
  };
  const patch = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!value) continue;
    if (lead && lead[key]) continue;
    patch[key] = value;
  }
  return patch;
}
