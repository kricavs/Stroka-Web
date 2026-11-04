// Calendar layout helpers. Pure; all day maths in the business zone via
// lib/shared/time.js (never the server's zone).
import { APP_TIMEZONE, addDays, addMonths, monthRange, parseYmd, weekStart, ymd } from "./time.js";

// Monday-first grid of 'YYYY-MM-DD' strings covering a month (4–6 weeks).
export function monthGrid(monthStr) {
  const first = `${monthStr}-01`;
  if (!parseYmd(first)) throw new Error(`Mes inválido: ${monthStr}`);
  const last = addDays(`${addMonths(monthStr, 1)}-01`, -1);
  const weeks = [];
  for (let d = weekStart(first); d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }
  return weeks;
}

export const weekDays = (anyDay) => {
  const s = weekStart(anyDay);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};

// Items → Map<'YYYY-MM-DD', item[]> (sorted by time). Undated items are
// returned separately.
export function groupByDay(items, tz = APP_TIMEZONE) {
  const byDay = new Map();
  const undated = [];
  for (const it of items) {
    if (!it.scheduledAt) {
      undated.push(it);
      continue;
    }
    const k = ymd(new Date(it.scheduledAt), tz);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(it);
  }
  for (const list of byDay.values()) list.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return { byDay, undated };
}

// Agenda: consecutive ISO weeks, each with its non-empty days.
export function groupByWeek(items, tz = APP_TIMEZONE) {
  const { byDay, undated } = groupByDay(items, tz);
  const weeks = new Map();
  for (const day of [...byDay.keys()].sort()) {
    const w = weekStart(day);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push({ day, items: byDay.get(day) });
  }
  return { weeks: [...weeks].map(([start, days]) => ({ start, days })), undated };
}

// Visible UTC window for a view (a month grid shows neighbouring days too).
export function viewRange(view, anchorDay, tz = APP_TIMEZONE) {
  if (view === "week") {
    const s = weekStart(anchorDay);
    return rangeOfDays(s, addDays(s, 6), tz);
  }
  if (view === "agenda") return rangeOfDays(anchorDay, addDays(anchorDay, 41), tz);
  const grid = monthGrid(anchorDay.slice(0, 7));
  return rangeOfDays(grid[0][0], grid[grid.length - 1][6], tz);
}

import { dayRange } from "./time.js";
function rangeOfDays(firstDay, lastDay, tz) {
  return { start: dayRange(firstDay, tz).start, end: dayRange(lastDay, tz).end };
}

export { monthRange };
