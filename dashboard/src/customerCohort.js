import { missionLwRegionId } from './shippingDestinations';

/** Same key as server/phoneKey.js so 054…, +972… and 972… count as one customer. */
export function israeliMobileKey(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('972')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  if (d.length > 9) d = d.slice(-9);
  return d;
}

export const COUNTRY_LABELS = { india: 'India', thailand: 'Thailand', unknown: 'Unknown' };
export const COUNTRY_COLORS = { india: '#f59e0b', thailand: '#0ea5e9', unknown: '#94a3b8' };
export const COUNTRY_ORDER = ['india', 'thailand', 'unknown'];

export function missionCountryId(mission) {
  return missionLwRegionId(mission) || 'unknown';
}

export function israelDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function shiftDateKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function customerName(mission) {
  const named = mission?.fullName || [mission?.firstName, mission?.lastName].filter(Boolean).join(' ');
  return named || '—';
}

export function formatIsraelDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Earliest mission per phone. Later orders from the same number are not new customers. */
export function firstMissionsByPhone(missions) {
  const byPhone = new Map();
  missions.forEach((mission) => {
    const phoneKey = israeliMobileKey(mission.customerPhone);
    if (!phoneKey || !mission.createdAt) return;
    const prev = byPhone.get(phoneKey);
    if (!prev || new Date(mission.createdAt) < new Date(prev.createdAt)) {
      byPhone.set(phoneKey, mission);
    }
  });
  return byPhone;
}

export function newCustomerWindow(filterDateFrom, filterDateTo, now = new Date()) {
  const today = israelDateKey(now);
  return {
    from: filterDateFrom || shiftDateKey(today, -29),
    to: filterDateTo || today,
  };
}

function firstMissionMatchesFilters(mission, filters) {
  if (filters.type && mission.type !== filters.type) return false;
  if (filters.status && mission.status !== filters.status) return false;
  if (filters.createdBy && mission.createdBy !== filters.createdBy) return false;
  if (filters.affiliate && (mission.affiliateName !== filters.affiliate || mission.type !== 'pickup')) return false;
  if (filters.country && missionCountryId(mission) !== filters.country) return false;
  const day = israelDateKey(mission.createdAt);
  if (!day || day < filters.from || day > filters.to) return false;
  return true;
}

export function selectNewCustomers(firstMissions, filters) {
  const rows = [];
  firstMissions.forEach((mission, phoneKey) => {
    if (!firstMissionMatchesFilters(mission, filters)) return;
    rows.push({
      phoneKey,
      phone: mission.customerPhone || phoneKey,
      name: customerName(mission),
      country: missionCountryId(mission),
      type: mission.type,
      createdAt: mission.createdAt,
      day: israelDateKey(mission.createdAt),
    });
  });
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rows;
}

export function countryBreakdown(missions) {
  const base = Object.fromEntries(
    COUNTRY_ORDER.map((key) => [key, {
      key,
      name: COUNTRY_LABELS[key],
      missions: 0,
      pickup: 0,
      empty_box: 0,
      boxes: 0,
    }]),
  );
  missions.forEach((mission) => {
    const key = missionCountryId(mission);
    const row = base[key] || base.unknown;
    row.missions += 1;
    if (mission.type === 'pickup') row.pickup += 1;
    else if (mission.type === 'empty_box') row.empty_box += 1;
    row.boxes += (mission.boxSelection?.large || 0) + (mission.boxSelection?.small || 0);
  });
  return COUNTRY_ORDER.map((key) => base[key]).filter((row) => row.missions > 0);
}

export function newCustomersOverTime(customers, range) {
  const days = {};
  let cursor = range.from;
  let guard = 0;
  while (cursor && range.to && cursor <= range.to && guard < 400) {
    days[cursor] = { india: 0, thailand: 0, unknown: 0 };
    cursor = shiftDateKey(cursor, 1);
    guard += 1;
  }
  customers.forEach((customer) => {
    if (!days[customer.day]) return;
    const key = days[customer.day][customer.country] != null ? customer.country : 'unknown';
    days[customer.day][key] += 1;
  });
  return Object.entries(days).map(([date, counts]) => ({
    date: date.slice(5).replace('-', '/'),
    ...counts,
  }));
}

export function countNewCustomersByCountry(customers) {
  const counts = { india: 0, thailand: 0, unknown: 0 };
  customers.forEach((customer) => {
    const key = counts[customer.country] != null ? customer.country : 'unknown';
    counts[key] += 1;
  });
  return counts;
}

export function inIsraelRange(mission, from, to) {
  if (!from && !to) return true;
  const day = israelDateKey(mission?.createdAt);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function activeCustomerCount(missions) {
  const phones = new Set();
  missions.forEach((mission) => {
    const key = israeliMobileKey(mission.customerPhone);
    if (key) phones.add(key);
  });
  return phones.size;
}

export function isRepeatOrder(mission, firstByPhone) {
  const key = israeliMobileKey(mission?.customerPhone);
  if (!key) return false;
  const first = firstByPhone.get(key);
  if (!first || !mission) return false;
  if (first.id && mission.id) return first.id !== mission.id;
  return new Date(mission.createdAt) > new Date(first.createdAt);
}

export function repeatOrderCount(missions, firstByPhone) {
  return missions.filter((mission) => isRepeatOrder(mission, firstByPhone)).length;
}

export function emptyBoxConversion(allMissions, periodMissions) {
  const linked = new Set();
  allMissions.forEach((mission) => {
    if (mission.linkedEmptyBoxMissionId) linked.add(mission.linkedEmptyBoxMissionId);
  });
  const opened = periodMissions.filter((mission) => mission.type === 'empty_box');
  const converted = opened.filter((mission) => linked.has(mission.id)).length;
  return {
    opened: opened.length,
    converted,
    pending: opened.length - converted,
    rate: opened.length ? Math.round((converted / opened.length) * 1000) / 10 : 0,
  };
}

function tallyBucket(missions, bucket, split) {
  const counts = {};
  if (!bucket) return counts;
  missions.forEach((mission) => {
    const day = israelDateKey(mission.createdAt);
    if (!day || day < bucket.from || day > bucket.to) return;
    const key = split(mission);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function compareKey(key) {
  return `compare${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export function seriesByBuckets(primaryMissions, compareMissions, primaryBuckets, compareBuckets, split, keys) {
  const length = Math.max(primaryBuckets.length, compareBuckets.length);
  const rows = [];
  for (let i = 0; i < length; i += 1) {
    const primaryBucket = primaryBuckets[i];
    const compareBucket = compareBuckets[i];
    const primaryCounts = tallyBucket(primaryMissions, primaryBucket, split);
    const compareCounts = tallyBucket(compareMissions, compareBucket, split);
    const row = {
      label: primaryBucket?.label || compareBucket?.label || '',
      primaryHint: primaryBucket ? `${primaryBucket.from} – ${primaryBucket.to}` : '',
      compareHint: compareBucket ? `${compareBucket.from} – ${compareBucket.to}` : '',
    };
    keys.forEach((key) => {
      row[key] = primaryCounts[key] || 0;
      row[compareKey(key)] = compareCounts[key] || 0;
    });
    rows.push(row);
  }
  return rows;
}
