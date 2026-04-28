/**
 * Optional outbound notify when a mission is created (e.g. Make.com hook).
 * Set MISSION_WEBHOOK_URL in env. No verify token or auth headers — plain POST + JSON.
 * Body matches LionWheel task/create payload (+ event); no full mission dump.
 */

import { buildLionWheelCreatePayloadForEmptyBox } from './lionwheel.js';

export async function notifyEmptyBoxMissionWebhook(mission) {
  const url = (process.env.MISSION_WEBHOOK_URL || '').trim();
  if (!url) return;

  const lionwheel_create = buildLionWheelCreatePayloadForEmptyBox(mission);
  const body = JSON.stringify({
    event: 'empty_box_created',
    lionwheel_create,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Webhook HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
}
