// Parses/serialises the calendar's URL state (view, anchor day, filters).
import { CONTENT_TYPES, PLATFORMS, STATUSES } from "../shared/content.js";
import { parseYmd, ymd } from "../shared/time.js";

const VIEWS = ["month", "week", "agenda"];
const pick = (v, allowed) => (typeof v === "string" && allowed.includes(v) ? v : "");

export function parseCalendarParams(sp = {}) {
  const view = VIEWS.includes(sp.view) ? sp.view : "month";
  const date = typeof sp.date === "string" && parseYmd(sp.date) ? sp.date : ymd(new Date());
  return {
    view,
    date,
    client: typeof sp.client === "string" ? sp.client.slice(0, 64) : "",
    platform: pick(sp.platform, PLATFORMS.map(([k]) => k)),
    status: pick(sp.status, STATUSES),
    type: pick(sp.type, CONTENT_TYPES.map(([k]) => k)),
  };
}

export function calendarHref(base, state, patch = {}) {
  const s = { ...state, ...patch };
  const q = new URLSearchParams();
  for (const k of ["view", "date", "client", "platform", "status", "type"]) if (s[k]) q.set(k, s[k]);
  const qs = q.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}
