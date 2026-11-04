// Timezone helpers. The server runs in UTC, so every "today / this month /
// due date" decision must go through here with an explicit zone.
//
// Storage rule: instants are TIMESTAMPTZ (UTC). Calendar days are plain
// 'YYYY-MM-DD' strings in the *business* zone. Never build a day boundary with
// `new Date(y, m, d)` (that uses the server's zone).
//
// Today the zone is global. To go per-client later, pass `client.timezone`
// as the `tz` argument everywhere — every helper already takes it.

export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

const fmtCache = new Map();
function parts(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const pad = (n, w = 2) => String(n).padStart(w, "0");

// Wall-clock components of an instant in `tz`. weekday: 1 = Monday … 7 = Sunday.
export function zonedParts(date, tz = APP_TIMEZONE) {
  const o = {};
  for (const p of parts(tz).formatToParts(date)) o[p.type] = p.value;
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour),
    minute: Number(o.minute),
    second: Number(o.second),
    weekday: WEEKDAYS[o.weekday],
  };
}

// Offset (minutes east of UTC) of `tz` at the given instant.
export function tzOffsetMinutes(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

// Wall-clock time in `tz` → the UTC instant (DST-safe; ambiguous/missing
// local times resolve deterministically).
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, tz = APP_TIMEZONE) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let t = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  t = guess - off2 * 60000;
  return new Date(t);
}

// 'YYYY-MM-DD' / 'YYYY-MM' of an instant, in `tz`.
export function ymd(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
export function monthKey(date, tz = APP_TIMEZONE) {
  return ymd(date, tz).slice(0, 7);
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM = /^(\d{4})-(\d{2})$/;

export function parseYmd(s) {
  const m = YMD.exec(String(s));
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

// Calendar arithmetic on day strings (zone-free, pure UTC maths).
export function addDays(ymdStr, n) {
  const p = parseYmd(ymdStr);
  if (!p) throw new Error(`Fecha inválida: ${ymdStr}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addMonths(monthStr, n) {
  const m = YM.exec(String(monthStr));
  if (!m) throw new Error(`Mes inválido: ${monthStr}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// Half-open UTC range [start, end) covering a local day / month / ISO week
// (Monday start). Use as `col >= $start AND col < $end`.
export function dayRange(ymdStr, tz = APP_TIMEZONE) {
  const p = parseYmd(ymdStr);
  if (!p) throw new Error(`Fecha inválida: ${ymdStr}`);
  return { start: zonedTimeToUtc(p, tz), end: zonedTimeToUtc(parseYmd(addDays(ymdStr, 1)), tz) };
}

export function monthRange(monthStr, tz = APP_TIMEZONE) {
  const m = YM.exec(String(monthStr));
  if (!m) throw new Error(`Mes inválido: ${monthStr}`);
  const next = addMonths(monthStr, 1);
  return {
    start: zonedTimeToUtc({ year: Number(m[1]), month: Number(m[2]), day: 1 }, tz),
    end: zonedTimeToUtc({ year: Number(next.slice(0, 4)), month: Number(next.slice(5)), day: 1 }, tz),
  };
}

export function weekStart(ymdStr) {
  const p = parseYmd(ymdStr);
  if (!p) throw new Error(`Fecha inválida: ${ymdStr}`);
  const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() || 7; // 1 = Monday
  return addDays(ymdStr, 1 - wd);
}

export function weekRange(ymdStr, tz = APP_TIMEZONE) {
  const first = weekStart(ymdStr);
  return { start: dayRange(first, tz).start, end: dayRange(addDays(first, 6), tz).end };
}

// ---- display (es-AR) ------------------------------------------------------

const MONTHS_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "08 NOV · 18:00"
export function formatSlot(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  return `${pad(p.day)} ${MONTHS_SHORT[p.month - 1]} · ${pad(p.hour)}:${pad(p.minute)}`;
}
// "08 NOV"
export function formatDayShort(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  return `${pad(p.day)} ${MONTHS_SHORT[p.month - 1]}`;
}
// "04/11/2026 · 14:32"
export function formatStamp(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} · ${pad(p.hour)}:${pad(p.minute)}`;
}
// "noviembre 2026"
export function formatMonthLong(monthStr) {
  const m = YM.exec(String(monthStr));
  if (!m) return String(monthStr);
  return `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}`;
}

// Value for <input type="datetime-local"> and back.
export function toLocalInput(date, tz = APP_TIMEZONE) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
export function fromLocalInput(value, tz = APP_TIMEZONE) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value));
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  if (!parseYmd(`${m[1]}-${m[2]}-${m[3]}`) || hour > 23 || minute > 59) return null;
  return zonedTimeToUtc({ year, month, day, hour, minute }, tz);
}
