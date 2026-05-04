/**
 * LionWheel REST API — https://github.com/lionwheel/api
 * Two accounts: one per shippingDestination (thailand / india).
 * Env vars:
 *   LIONWHEEL_KEY_THAILAND, LIONWHEEL_COMPANY_ID_THAILAND
 *   LIONWHEEL_KEY_INDIA,    LIONWHEEL_COMPANY_ID_INDIA
 */

const LIONWHEEL_BASE = 'https://members.lionwheel.com/api/v1';

/**
 * Returns { key, companyId } for the given shippingDestination.
 * destination: 'thailand' | 'india' (case-insensitive)
 * Returns null if the destination is unknown or the key is not set.
 */
export function getLionWheelCredentials(destination) {
  const dest = String(destination || '').trim().toLowerCase();
  if (dest === 'thailand') {
    const key = (process.env.LIONWHEEL_KEY_THAILAND || '').trim();
    const companyId = parseInt(process.env.LIONWHEEL_COMPANY_ID_THAILAND || '', 10) || null;
    if (!key) return null;
    return { key, companyId };
  }
  if (dest === 'india') {
    const key = (process.env.LIONWHEEL_KEY_INDIA || '').trim();
    const companyId = parseInt(process.env.LIONWHEEL_COMPANY_ID_INDIA || '', 10) || null;
    if (!key) return null;
    return { key, companyId };
  }
  return null;
}

function formatPickupAtDdMmYyyy(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function recipientNameFromMission(mission) {
  const first = String(mission.firstName || '').trim();
  const last = String(mission.lastName || '').trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  return String(mission.fullName || '').trim();
}

function buildEmptyBoxNotes(mission) {
  const boxes = (mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0);
  const base = `משלוח ${boxes} ארגזים ריקים`;
  const extra = String(mission.notes || '').trim();
  return extra ? `${base} | ${extra}` : base;
}

function lineItemsFromBoxSelection(boxSelection) {
  const large = boxSelection?.large || 0;
  const small = boxSelection?.small || 0;
  const items = [];
  if (large > 0) {
    items.push({
      name: 'ISA-BOX-70',
      quantity: String(large),
      sku: 'ISA-BOX-70',
      notes: 'Large empty box 45×45×70 cm',
    });
  }
  if (small > 0) {
    items.push({
      name: 'ISA-BOX-35',
      quantity: String(small),
      sku: 'ISA-BOX-35',
      notes: 'Small empty box 45×45×35 cm',
    });
  }
  return items.length ? items : undefined;
}

/** Pickup: packed boxes from customer + optional empty boxes (same SKUs as empty_box flow). */
function lineItemsForPickupMission(mission) {
  const items = [];
  const pickupCount = mission.pickupBoxCount ?? 0;
  if (pickupCount > 0) {
    items.push({
      name: 'ISA-BOX-70',
      quantity: String(pickupCount),
      sku: 'ISA-BOX-70',
      notes: 'Packed boxes — pickup from customer',
    });
  }
  if (mission.bringBoxes) {
    const emptyLines = lineItemsFromBoxSelection(mission.boxSelection);
    if (emptyLines) items.push(...emptyLines);
  }
  return items.length ? items : undefined;
}

/**
 * Build notes string for LionWheel based on type and box counts.
 * type: 'empty' | 'pickup'
 */
function buildNotesFromRequest({ type, boxes = 0, emptyBoxes = 0, notes = '' }) {
  let base;
  if (type === 'empty') {
    base = `משלוח ${boxes} ארגזים ריקים`;
  } else if (emptyBoxes > 0) {
    base = `איסוף ${boxes} ארגזים + ${emptyBoxes} ארגזים ריקים`;
  } else {
    base = `איסוף ${boxes} ארגזים`;
  }
  const extra = String(notes || '').trim();
  return extra ? `${base} | ${extra}` : base;
}

/**
 * Build a LionWheel tasks/create payload from the POST /api/lionwheel/create request body.
 * @param {{ orderId, type, boxes, emptyBoxes, city, street, number, name, phone, destination }} body
 * destination: 'thailand' | 'india' — determines which API key + company_id to embed
 */
export function buildLionWheelPayloadFromRequest(body) {
  const {
    orderId,
    type,
    boxes = 0,
    emptyBoxes = 0,
    city,
    street,
    number: houseNumber,
    name,
    phone,
    destination,
  } = body;

  const creds = getLionWheelCredentials(destination);

  const payload = {
    pickup_at: formatPickupAtDdMmYyyy(),
    original_order_id: String(orderId),
    destination_city: String(city || '').trim(),
    destination_street: String(street || '').trim(),
    destination_number: String(houseNumber || '').trim() || '—',
    destination_recipient_name: String(name || '').trim(),
    destination_phone: String(phone || '').trim(),
    notes: buildNotesFromRequest({ type, boxes, emptyBoxes }),
  };

  if (creds?.companyId) payload.company_id = creds.companyId;
  if (boxes > 0) payload.packages_quantity = boxes;

  return payload;
}

/**
 * Send a payload directly to LionWheel and return normalized result.
 * @param {object} payload — already built payload
 * @param {string} destination — 'thailand' | 'india' — selects which API key to use
 */
export async function sendLionWheelCreatePayload(payload, destination) {
  const destNorm = String(destination ?? '').trim().toLowerCase();
  if (destNorm !== 'india' && destNorm !== 'thailand') {
    const got =
      destination == null || String(destination).trim() === '' ? '(none)' : String(destination).trim();
    return {
      skipped: true,
      reason: `Missing or invalid LionWheel destination (india|thailand); got: ${got}`,
    };
  }
  const creds = getLionWheelCredentials(destNorm);
  if (!creds) {
    return { skipped: true, reason: `No LionWheel credentials for destination: ${destNorm}` };
  }
  const { key } = creds;

  const url = `${LIONWHEEL_BASE}/tasks/create?key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, status: 0, error: e.message || 'LionWheel network error' };
  }

  const rawText = await res.text();
  let data = null;
  if (rawText) {
    try { data = JSON.parse(rawText); } catch { data = null; }
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: lionWheelErrorMessage(res.status, data, rawText) };
  }

  return {
    ok: true,
    taskId: data?.task_id,
    publicId: data?.public_id ?? null,
    destinationRegionStr: data?.destination_region_str ?? null,
    label: data?.label ?? null,
    barcode: data?.barcode ?? null,
    trackingLink: data?.tracking_link ?? null,
  };
}


function lionWheelErrorMessage(status, data, rawText) {
  if (data && typeof data === 'object') {
    const msg =
      data.error ||
      data.message ||
      data.errors ||
      (Array.isArray(data.base) ? data.base.join('; ') : null);
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    try {
      return JSON.stringify(data);
    } catch {
      return rawText || `HTTP ${status}`;
    }
  }
  return (rawText && String(rawText).trim()) || `HTTP ${status}`;
}

/**
 * india / thailand key for LionWheel credentials from a stored mission.
 */
export function lionWheelDestinationFromMission(mission) {
  const raw = mission?.shippingDestination ?? mission?.country;
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().toLowerCase();
  return s === 'india' || s === 'thailand' ? s : null;
}

/** Real API returns status as string enum (e.g. ASSIGNED); README lists numeric codes. */
const LIONWHEEL_API_STATUS_STRING = {
  UNASSIGNED: 0,
  ASSIGNED: 1,
  ACTIVE: 2,
  COMPLETED: 3,
  CANCELED: 4,
  CANCELLED: 4,
  ROUNDTRIP_DELIVERED: 5,
  IN_INVENTORY: 6,
  OUT_INVENTORY: 7,
  FAILED: 8,
  FINAL_FAILED: 9,
  IN_TRANSFER: 10,
};

/** Maps LionWheel numeric or string status (e.g. ASSIGNED) to internal 0–10 code. Exported for Make webhook handler. */
export function lionWheelApiStatusToNum(raw) {
  if (raw == null) return NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(LIONWHEEL_API_STATUS_STRING, s)) {
    return LIONWHEEL_API_STATUS_STRING[s];
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : NaN;
}

/** LionWheel task status → label (tasks/show response per README). */
export function lionWheelTaskStatusLabel(status) {
  const labels = {
    0: 'Unassigned',
    1: 'Assigned',
    2: 'Active',
    3: 'Completed',
    4: 'Canceled',
    5: 'Roundtrip delivered',
    6: 'In inventory',
    7: 'Out inventory',
    8: 'Failed',
    9: 'Final failed',
    10: 'In transfer',
  };
  if (typeof status !== 'number' || !Number.isFinite(status)) return '—';
  return labels[status] ?? `Status ${status}`;
}

function extractTaskStatusFromShowPayload(data) {
  if (data == null) return NaN;
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === 'object') {
        const n = extractTaskStatusFromShowPayload(row);
        if (Number.isFinite(n)) return n;
      }
    }
    return NaN;
  }
  if (typeof data !== 'object') return NaN;
  if (data.task && typeof data.task === 'object' && data.task.status != null) {
    const n = lionWheelApiStatusToNum(data.task.status);
    if (Number.isFinite(n)) return n;
  }
  if (Array.isArray(data.tasks)) {
    const n = extractTaskStatusFromShowPayload(data.tasks);
    if (Number.isFinite(n)) return n;
  }
  const candidates = [
    data.status,
    data.task_status,
    data.delivery_status,
    data.task?.status,
    data.delivery?.status,
    data.attributes?.status,
    data.data?.status,
    data.meta?.status,
  ];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = lionWheelApiStatusToNum(raw);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/**
 * Normalize Make.com / LionWheel webhook JSON → task id + numeric status for mission merge.
 * Supports root-level `id` / `status` (e.g. `{ id: 123, status: "ACTIVE" }`) when `task` is absent.
 */
export function extractLionWheelWebhookFields(body) {
  const b = body && typeof body === 'object' ? body : {};
  const nested = b.task || b.data || b.payload || {};

  const taskIdRaw =
    b.task_id ??
    b.taskId ??
    nested.task_id ??
    nested.id ??
    nested.task?.id ??
    b.id;

  const tid =
    typeof taskIdRaw === 'number' && Number.isFinite(taskIdRaw)
      ? taskIdRaw
      : parseInt(String(taskIdRaw ?? '').replace(/\s/g, ''), 10);

  const statusRaw =
    nested.status ??
    nested.task?.status ??
    b.task?.status ??
    b.status;

  let taskStatusNum = lionWheelApiStatusToNum(statusRaw);
  if (!Number.isFinite(taskStatusNum)) {
    taskStatusNum = extractTaskStatusFromShowPayload(b);
  }

  const orderIdCoerced =
    nested.order_id != null && String(nested.order_id).trim()
      ? String(nested.order_id).trim()
      : b.order_id != null && String(b.order_id).trim()
        ? String(b.order_id).trim()
        : null;

  const missionIdHint =
    (typeof b.original_order_id === 'string' && b.original_order_id.trim()) ||
    (typeof b.wp_order_id === 'string' && b.wp_order_id.trim()) ||
    (typeof nested.wp_order_id === 'string' && nested.wp_order_id.trim()) ||
    (typeof b.mission_id === 'string' && b.mission_id.trim()) ||
    orderIdCoerced;

  return {
    taskId: Number.isFinite(tid) ? tid : null,
    taskStatusNum: Number.isFinite(taskStatusNum) ? taskStatusNum : null,
    missionIdHint,
  };
}

function companyQuerySuffix(companyId) {
  return companyId != null && companyId !== '' ? `&company_id=${encodeURIComponent(String(companyId))}` : '';
}

/**
 * LionWheel "Receiving delivery" (github.com/lionwheel/api README):
 *   Method: GET
 *   Url:    https://members.lionwheel.com/api/v1/tasks/show/?key=XXXXXX
 *   Payload: json  → identifies the task; use LionWheel task_id (integer returned from tasks/create).
 * In practice many clients send task_id as JSON body (POST) or as query task_id= on GET.
 *
 * Response fields include status (0–10), task_id, driver_id, …
 *
 * @param {string|number} taskId — LionWheel task_id from create response
 * @param {string} destination — india | thailand (selects API key / company_id)
 * @param {{ originalOrderId?: string }} [options] — optional fallback GET …/tasks/by_order_id/:order_id
 */
export async function fetchLionWheelTaskShow(taskId, destination, options = {}) {
  const { originalOrderId } = options || {};
  const creds = getLionWheelCredentials(destination);
  if (!creds) {
    return { ok: false, skipped: true, reason: 'No LionWheel credentials for destination' };
  }
  const key = encodeURIComponent(creds.key);
  const cq = companyQuerySuffix(creds.companyId);
  const tidStr = String(taskId).trim();
  const tidEnc = encodeURIComponent(tidStr);
  const numericId = parseInt(tidStr, 10);
  const baseQ = `key=${key}${cq}`;

  const taskIdPayload = JSON.stringify({
    task_id: Number.isFinite(numericId) ? numericId : tidStr,
    ...(creds.companyId != null ? { company_id: creds.companyId } : {}),
  });

  /** Live API: GET /tasks/{id}?key=&company_id= returns { task: { status: "ASSIGNED", ... } }. */
  const attempts = [
    { method: 'GET', url: `${LIONWHEEL_BASE}/tasks/show/${tidEnc}?${baseQ}` },
    { method: 'POST', url: `${LIONWHEEL_BASE}/tasks/show/?${baseQ}`, body: taskIdPayload },
    { method: 'POST', url: `${LIONWHEEL_BASE}/tasks/show?${baseQ}`, body: taskIdPayload },
    { method: 'GET', url: `${LIONWHEEL_BASE}/tasks/show/?${baseQ}&task_id=${tidEnc}` },
    { method: 'GET', url: `${LIONWHEEL_BASE}/tasks/show?${baseQ}&task_id=${tidEnc}` },
  ];

  const oid = originalOrderId != null ? String(originalOrderId).trim() : '';
  if (oid) {
    attempts.push({
      method: 'GET',
      url: `${LIONWHEEL_BASE}/tasks/by_order_id/${encodeURIComponent(oid)}?${baseQ}`,
    });
  }

  let lastFail = null;

  for (const a of attempts) {
    let res;
    try {
      res = await fetch(a.url, {
        method: a.method,
        headers: {
          Accept: 'application/json',
          ...(a.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(a.body ? { body: a.body } : {}),
      });
    } catch (e) {
      lastFail = { ok: false, error: e.message || 'LionWheel network error' };
      continue;
    }
    const rawText = await res.text();
    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      lastFail = { ok: false, status: res.status, error: lionWheelErrorMessage(res.status, data, rawText) };
      continue;
    }
    const taskStatus = extractTaskStatusFromShowPayload(data);
    if (Number.isFinite(taskStatus)) {
      return { ok: true, taskStatus };
    }
    const hint = data && typeof data === 'object' ? JSON.stringify(data).slice(0, 220) : String(rawText || '').slice(0, 220);
    lastFail = { ok: false, error: `Missing status in LionWheel response (${a.method} ${a.url.split('?')[0]}) ${hint}` };
  }

  return lastFail || { ok: false, error: 'LionWheel tasks/show failed' };
}

/**
 * JSON body for POST /api/v1/tasks/create for an empty_box mission.
 * company_id is resolved from LionWheel region (mission.country or legacy shippingDestination).
 */
export function buildLionWheelCreatePayloadForEmptyBox(mission) {
  const addr = mission.address || {};
  const city = String(addr.city || '').trim();
  const street = String(addr.street || '').trim();
  const houseNumber = String(addr.houseNumber || '').trim();
  const recipient = recipientNameFromMission(mission);
  const phone = String(mission.customerPhone || '').trim();
  const destination_number = houseNumber || '—';

  const dest = lionWheelDestinationFromMission(mission);
  const creds = getLionWheelCredentials(dest);
  const boxes = (mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0);

  const payload = {
    pickup_at: formatPickupAtDdMmYyyy(),
    original_order_id: mission.id,
    destination_city: city,
    destination_street: street,
    destination_number,
    destination_recipient_name: recipient,
    destination_phone: phone,
    notes: buildEmptyBoxNotes(mission),
  };

  if (creds?.companyId) payload.company_id = creds.companyId;
  if (boxes > 0) payload.packages_quantity = boxes;

  const lineItems = lineItemsFromBoxSelection(mission.boxSelection);
  if (lineItems) payload.line_items = lineItems;

  const apt = addr.apartment != null && String(addr.apartment).trim() !== '' ? String(addr.apartment).trim() : '';
  if (apt) payload.destination_apartment = apt;
  const floor = addr.floor != null && String(addr.floor).trim() !== '' ? String(addr.floor).trim() : '';
  if (floor) payload.destination_floor = floor;

  const zipFromDisplay = String(addr.displayAddress || '').match(/\b(\d{5,7})\b/);
  if (zipFromDisplay) payload.destination_zip_code = zipFromDisplay[1];

  const lat = addr.lat != null ? Number(addr.lat) : NaN;
  const lng = addr.lng != null ? Number(addr.lng) : NaN;
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    payload.destination_latitude = lat;
    payload.destination_longitude = lng;
  }

  return payload;
}

/**
 * Create a LionWheel task for an empty_box mission (destination = customer delivery address).
 * @param {object} mission — stored mission with id, fullName, customerPhone, address, boxSelection
 * @returns {Promise<{ skipped?: true, reason?: string } | { ok: true, taskId, publicId, trackingLink, barcode, label, destinationRegionStr } | { ok: false, status: number, error: string }>}
 */
export async function createLionWheelTaskForEmptyBoxMission(mission) {
  const payload = buildLionWheelCreatePayloadForEmptyBox(mission);
  if (
    !payload.destination_city ||
    !payload.destination_street ||
    !payload.destination_recipient_name ||
    !payload.destination_phone
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Missing required mission fields for LionWheel (city, street, name, phone)',
    };
  }
  return sendLionWheelCreatePayload(payload, lionWheelDestinationFromMission(mission));
}

/**
 * Create a LionWheel task for a pickup mission.
 * Uses the customer's address (mission.address) as the pickup/destination point,
 * same structure as empty_box missions.
 */
export async function createLionWheelTaskForPickupMission(mission) {
  const addr = mission.address || {};
  const city = String(addr.city || '').trim();
  const street = String(addr.street || '').trim();
  const houseNumber = String(addr.houseNumber || '').trim();
  const recipient = recipientNameFromMission(mission);
  const phone = String(mission.customerPhone || '').trim();

  if (!city || !street || !recipient || !phone) {
    return { ok: false, status: 400, error: 'Missing pickup mission fields for LionWheel (address city/street, name, phone)' };
  }

  const pickupBoxes = mission.pickupBoxCount ?? 0;
  const emptyBoxes = mission.bringBoxes
    ? (mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0)
    : 0;
  const destination = mission.shippingDestination || mission.country;
  const creds = getLionWheelCredentials(destination);

  const payload = {
    pickup_at: formatPickupAtDdMmYyyy(),
    original_order_id: mission.id,
    destination_city: city,
    destination_street: street,
    destination_number: houseNumber || '—',
    destination_recipient_name: recipient,
    destination_phone: phone,
    notes: buildNotesFromRequest({
      type: 'pickup',
      boxes: pickupBoxes,
      emptyBoxes,
      notes: mission.notes,
    }),
  };

  if (creds?.companyId) payload.company_id = creds.companyId;
  if (pickupBoxes > 0) payload.packages_quantity = pickupBoxes;

  const lineItems = lineItemsForPickupMission(mission);
  if (lineItems) payload.line_items = lineItems;

  const apt = addr.apartment != null && String(addr.apartment).trim() !== '' ? String(addr.apartment).trim() : '';
  if (apt) payload.destination_apartment = apt;
  const floor = addr.floor != null && String(addr.floor).trim() !== '' ? String(addr.floor).trim() : '';
  if (floor) payload.destination_floor = floor;

  const zipFromDisplay = String(addr.displayAddress || '').match(/\b(\d{5,7})\b/);
  if (zipFromDisplay) payload.destination_zip_code = zipFromDisplay[1];

  const lat = addr.lat != null ? Number(addr.lat) : NaN;
  const lng = addr.lng != null ? Number(addr.lng) : NaN;
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    payload.destination_latitude = lat;
    payload.destination_longitude = lng;
  }

  return sendLionWheelCreatePayload(payload, destination);
}
