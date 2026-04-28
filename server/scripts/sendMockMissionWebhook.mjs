/**
 * Same JSON as notifyEmptyBoxMissionWebhook: event + lionwheel_create (LionWheel API body).
 * Loads the newest empty_box mission from Postgres (same as prod) when DATABASE_URL is set.
 *
 * Usage (from server/):
 *   node --env-file=.env scripts/sendMockMissionWebhook.mjs https://hook...
 *   MOCK_MISSION_ID=MSN-123 node --env-file=.env scripts/sendMockMissionWebhook.mjs https://...
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildLionWheelCreatePayloadForEmptyBox } from '../lionwheel.js';
import { readMissions } from '../storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetUrl = (process.env.MISSION_WEBHOOK_URL || process.argv[2] || '').trim();
const pickId = (process.env.MOCK_MISSION_ID || process.argv[3] || '').trim();

if (!targetUrl) {
  console.error('Usage: node --env-file=.env scripts/sendMockMissionWebhook.mjs <webhook-url> [mission-id]');
  process.exit(1);
}

let missions;
if (process.env.DATABASE_URL) {
  try {
    missions = await readMissions();
    console.error('Loaded missions from DB:', missions.length);
  } catch (e) {
    console.error('DB read failed:', e.message);
    missions = null;
  }
}
if (!missions || missions.length === 0) {
  const missionsPath = join(__dirname, '../data/missions.json');
  missions = JSON.parse(readFileSync(missionsPath, 'utf8'));
  console.error('Fallback: data/missions.json');
}

let sample;
if (pickId) {
  sample = missions.find((m) => m.id === pickId && m.type === 'empty_box');
  if (!sample) {
    console.error(`No empty_box mission with id ${pickId}`);
    process.exit(1);
  }
} else {
  sample = missions.find((m) => m.type === 'empty_box');
  if (!sample) {
    console.error('No empty_box mission found');
    process.exit(1);
  }
}

/** Real row from DB — no id override */
const mission = sample;

const body = {
  event: 'empty_box_created',
  lionwheel_create: buildLionWheelCreatePayloadForEmptyBox(mission),
};

console.error('Using mission:', mission.id, mission.fullName, mission.address?.displayAddress?.slice(0, 60));
console.log(JSON.stringify(body, null, 2));

const res = await fetch(targetUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const text = await res.text();
console.error('HTTP:', res.status, text.slice(0, 500));
if (!res.ok) process.exit(1);
