export const PERIOD_PRESETS = [
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'month_before', label: 'Month before last' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'last_quarter', label: 'Last quarter' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function parts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function dateKey(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function weekday(key) {
  const { y, m, d } = parts(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function shiftMonth(y, m, delta) {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

export function inclusiveDays(from, to) {
  if (!from || !to || from > to) return 0;
  const start = parts(from);
  const end = parts(to);
  const a = Date.UTC(start.y, start.m - 1, start.d);
  const b = Date.UTC(end.y, end.m - 1, end.d);
  return Math.round((b - a) / 86400000) + 1;
}

function capAtToday(from, end, today) {
  const partial = today >= from && today < end;
  return {
    from,
    to: partial ? today : end,
    partial,
  };
}

function monthSpan(y, m, today) {
  const from = dateKey(y, m, 1);
  const end = dateKey(y, m, daysInMonth(y, m));
  return { ...capAtToday(from, end, today), unit: 'month' };
}

function quarterSpan(y, startMonth, today) {
  const from = dateKey(y, startMonth, 1);
  const endMonth = startMonth + 2;
  const end = dateKey(y, endMonth, daysInMonth(y, endMonth));
  return { ...capAtToday(from, end, today), unit: 'quarter' };
}

function yearSpan(y, today) {
  return { ...capAtToday(dateKey(y, 1, 1), dateKey(y, 12, 31), today), unit: 'year' };
}

export function periodRange(presetId, now = new Date()) {
  const today = israelDateKey(now);
  const { y, m } = parts(today);
  const weekStart = shiftDateKey(today, -weekday(today));

  if (presetId === 'this_week') {
    const weekEnd = shiftDateKey(weekStart, 6);
    return { from: weekStart, to: today, partial: today < weekEnd, unit: 'week' };
  }
  if (presetId === 'last_week') {
    const end = shiftDateKey(weekStart, -1);
    return { from: shiftDateKey(end, -6), to: end, partial: false, unit: 'week' };
  }
  if (presetId === 'this_month') return monthSpan(y, m, today);
  if (presetId === 'last_month') {
    const prev = shiftMonth(y, m, -1);
    return monthSpan(prev.y, prev.m, '0000-01-01');
  }
  if (presetId === 'month_before') {
    const prev = shiftMonth(y, m, -2);
    return monthSpan(prev.y, prev.m, '0000-01-01');
  }
  const quarterStart = Math.floor((m - 1) / 3) * 3 + 1;
  if (presetId === 'this_quarter') return quarterSpan(y, quarterStart, today);
  if (presetId === 'last_quarter') {
    const prev = shiftMonth(y, quarterStart, -3);
    return quarterSpan(prev.y, prev.m, '0000-01-01');
  }
  if (presetId === 'this_year') return yearSpan(y, today);
  if (presetId === 'last_year') return yearSpan(y - 1, '0000-01-01');
  return null;
}

export function customPrevious(from, to) {
  const len = inclusiveDays(from, to);
  if (!len) return { from: '', to: '', partial: false, unit: 'custom' };
  const end = shiftDateKey(from, -1);
  return {
    from: shiftDateKey(end, -(len - 1)),
    to: end,
    partial: false,
    unit: 'custom',
  };
}

export function previousRange(presetId, now = new Date()) {
  const current = periodRange(presetId, now);
  if (!current) return null;
  if (current.unit === 'week') {
    return {
      from: shiftDateKey(current.from, -7),
      to: shiftDateKey(current.from, -1),
      partial: false,
      unit: 'week',
    };
  }
  if (current.unit === 'month') {
    const { y, m } = parts(current.from);
    const prev = shiftMonth(y, m, -1);
    return monthSpan(prev.y, prev.m, '0000-01-01');
  }
  if (current.unit === 'quarter') {
    const { y, m } = parts(current.from);
    const prev = shiftMonth(y, m, -3);
    return quarterSpan(prev.y, prev.m, '0000-01-01');
  }
  if (current.unit === 'year') {
    const { y } = parts(current.from);
    return yearSpan(y - 1, '0000-01-01');
  }
  return customPrevious(current.from, current.to);
}

function clipToElapsed(range, days) {
  if (!range?.from || days <= 0) return range;
  const to = shiftDateKey(range.from, days - 1);
  return { ...range, to: to < range.to ? to : range.to };
}

export function resolveCompareRange(periodId, primary, compareId, now = new Date()) {
  let compare;
  if (compareId && compareId !== 'previous') {
    const named = periodRange(compareId, now);
    compare = named || customPrevious(primary.from, primary.to);
  } else if (!periodId || periodId === 'custom') {
    compare = customPrevious(primary.from, primary.to);
  } else {
    compare = previousRange(periodId, now);
  }
  if (primary?.partial && compare?.unit && primary.unit && compare.unit === primary.unit) {
    compare = clipToElapsed(compare, inclusiveDays(primary.from, primary.to));
  }
  return compare;
}

export function bucketUnit(from, to) {
  const days = inclusiveDays(from, to);
  if (days <= 14) return 'day';
  if (days <= 45) return 'week';
  return 'month';
}

export function bucketUnitFor(range) {
  if (range?.unit === 'week') return 'day';
  if (range?.unit === 'month') return 'week';
  if (range?.unit === 'quarter' || range?.unit === 'year') return 'month';
  return bucketUnit(range?.from, range?.to);
}

export function bucketUnitLabel(unit) {
  if (unit === 'day') return 'By day';
  if (unit === 'week') return 'By week';
  if (unit === 'month') return 'By month';
  return '';
}

function dayLabel(key) {
  return `${key.slice(8)}/${key.slice(5, 7)}`;
}

function weekLabel(from, to) {
  if (from === to) return dayLabel(from);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${Number(from.slice(8))}–${Number(to.slice(8))}/${from.slice(5, 7)}`;
  }
  return `${dayLabel(from)}–${dayLabel(to)}`;
}

function monthLabel(key) {
  const { y, m } = parts(key);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function buildBuckets(from, to, unit = bucketUnit(from, to)) {
  const buckets = [];
  if (!from || !to || from > to) return buckets;
  if (unit === 'day') {
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 400) {
      buckets.push({ from: cursor, to: cursor, label: dayLabel(cursor) });
      cursor = shiftDateKey(cursor, 1);
      guard += 1;
    }
    return buckets;
  }
  if (unit === 'week') {
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 80) {
      const weekEnd = shiftDateKey(cursor, 6);
      const end = weekEnd < to ? weekEnd : to;
      buckets.push({ from: cursor, to: end, label: weekLabel(cursor, end) });
      cursor = shiftDateKey(end, 1);
      guard += 1;
    }
    return buckets;
  }
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 36) {
    const { y, m } = parts(cursor);
    const monthEnd = dateKey(y, m, daysInMonth(y, m));
    const end = monthEnd < to ? monthEnd : to;
    buckets.push({ from: cursor, to: end, label: monthLabel(cursor) });
    cursor = shiftDateKey(end, 1);
    guard += 1;
  }
  return buckets;
}

export function formatRange(from, to) {
  if (!from || !to) return '';
  const fmt = (key) => {
    const { y, m, d } = parts(key);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function shortRange(from, to) {
  if (!from || !to) return '';
  const start = parts(from);
  const end = parts(to);
  const startMonth = MONTHS[start.m - 1];
  const endMonth = MONTHS[end.m - 1];
  if (from === to) return `${start.d} ${startMonth}`;
  if (start.y === end.y && start.m === end.m) return `${start.d}–${end.d} ${startMonth}`;
  if (start.y === end.y) return `${start.d} ${startMonth} – ${end.d} ${endMonth}`;
  return `${start.d} ${startMonth} ${start.y} – ${end.d} ${endMonth} ${end.y}`;
}

export function presetLabel(id) {
  return PERIOD_PRESETS.find((preset) => preset.id === id)?.label || 'Custom range';
}

export function changePct(current, previous) {
  const next = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (!prev) return next ? null : 0;
  return Math.round(((next - prev) / prev) * 1000) / 10;
}
