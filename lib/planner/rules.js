// Planning rules shared by every source (xlsx today; AI / MCP / manual later).
// PURE and browser-safe: no db, no node modules. The planning item shape below
// is the ONE contract every source must produce:
//
//   PlanningItemInput = {
//     date: 'YYYY-MM-DD',            // business-zone calendar day
//     time?: 'HH:MM' | null,         // null = the source gave no time
//     externalCode?: string | null,  // stable id inside the plan ("R4"); enables re-import updates
//     format: string,                // human label: "Reel", "Carrusel", "Historia", "Pieza única"…
//     title: string,
//     detail?, pillar?, cta?: string,
//     platform?: string | null,      // overrides the draft's default platform
//     sourceSheet?, sourceRow?,      // provenance (xlsx)
//     warnings?: { level, code, text }[]   // source-level findings, kept as-is
//   }
import { CONTENT_TYPES, PLATFORMS } from "../shared/content.js";
import { addDays, parseYmd, zonedTimeToUtc } from "../shared/time.js";

export const SOURCE_TYPES = ["xlsx", "ai", "mcp", "manual"];
export const DRAFT_STATUSES = ["draft", "applied", "cancelled"];
// States an import may create content in. `idea` does not count toward the
// monthly goal (Phase 4), so `production` is the default.
export const IMPORT_STATUSES = [["production", "En producción"], ["idea", "Idea"]];
export const DEFAULT_IMPORT_STATUS = "production";
// Sources without a time of day: this explicit, visible hour is used (business zone).
export const DEFAULT_TIME = "12:00";

export const ACTIONS = ["create", "update", "no_change", "conflict", "possible_duplicate", "skip"];
export const ACTION_LABEL = {
  create: "Crear", update: "Actualizar", no_change: "Sin cambios", conflict: "Conflicto", possible_duplicate: "Posible duplicado", skip: "Omitir",
};

// ---- text ----------------------------------------------------------------

// lower, no accents, punctuation → space, single spaces.
export function normText(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Token-set similarity (Jaccard) of two titles, 0..1.
export function similarity(a, b) {
  const ta = new Set(normText(a).split(" ").filter(Boolean));
  const tb = new Set(normText(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

// ---- formats ---------------------------------------------------------------

// Only unambiguous labels. Anything else is an error shown in the preview.
const FORMAT_TO_TYPE = {
  reel: "reel", reels: "reel",
  carrusel: "carousel", carruseles: "carousel", carousel: "carousel",
  historia: "story", historias: "story", story: "story", stories: "story",
  "pieza unica": "post", post: "post", posteo: "post", publicacion: "post", "imagen unica": "post", "foto unica": "post",
  video: "video", short: "short", shorts: "short", articulo: "article", nota: "article",
};
export const formatToType = (label) => FORMAT_TO_TYPE[normText(label)] || null;
export const FORMAT_LABELS = CONTENT_TYPES; // [key, label] for editing in the preview

export function platformKey(v) {
  const n = normText(v);
  const hit = PLATFORMS.find(([k, l]) => k === n || normText(l) === n);
  return hit ? hit[0] : null;
}

// ---- dates -----------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");

// Excel serial → { date, time|null }. Fraction of day → time (rounded to the minute).
export function serialToDateTime(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const days = Math.floor(serial);
  const d = new Date(Date.UTC(1899, 11, 30 + days));
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const mins = Math.round((serial - days) * 1440);
  if (mins <= 0) return { date, time: null };
  if (mins >= 1440) return { date: addDays(date, 1), time: null };
  return { date, time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` };
}

// 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:MM' | 'DD/MM/YYYY' | 'DD-MM-YYYY' (day first, es-AR).
export function parseDateText(raw) {
  const s = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  let y, mo, d, hh = null, mm = null;
  if (m) [, y, mo, d, hh, mm] = m;
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
  } else return null;
  const date = `${y}-${pad(Number(mo))}-${pad(Number(d))}`;
  if (!parseYmd(date)) return null;
  return { date, time: hh != null && !(hh === "00" && mm === "00") ? `${hh}:${mm}` : null };
}

export function validTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? ""));
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? `${pad(h)}:${m[2]}` : null;
}

// Business-zone date (+ time, or the draft default) → UTC instant. Never UTC midnight.
export function scheduledInstant(date, time, defaultTime = DEFAULT_TIME) {
  const p = parseYmd(date);
  const t = validTime(time) || validTime(defaultTime) || DEFAULT_TIME;
  if (!p) return null;
  const [hour, minute] = t.split(":").map(Number);
  return zonedTimeToUtc({ ...p, hour, minute });
}

// ---- item validation ---------------------------------------------------------

const issue = (level, code, text) => ({ level, code, text });
export const TITLE_MAX = 200;
export const DETAIL_MAX = 3000;

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n/g, "\n").trim().slice(0, max);

/**
 * Normalises one source item and reports what is wrong with it.
 * @returns {{ fields: object, issues: {level,code,text}[] }}
 */
export function validatePlanningItem(item) {
  const issues = [...(Array.isArray(item.warnings) ? item.warnings.filter((w) => w && w.code).map((w) => issue(w.level === "error" ? "error" : "warning", w.code, String(w.text || "").slice(0, 300))) : [])];
  const code = clean(item.externalCode, 40).toUpperCase() || null;
  const f = {
    external_code: code && /^[A-Z0-9][A-Z0-9._-]*$/.test(code) ? code : null,
    format: clean(item.format, 60),
    title: "",
    detail: clean(item.detail, DETAIL_MAX) || null,
    pillar: clean(item.pillar, 120) || null,
    cta: clean(item.cta, 300) || null,
    platform: null,
    scheduled_date: null,
    scheduled_time: null,
    content_type: null,
    source_sheet: item.sourceSheet ? clean(item.sourceSheet, 80) : null,
    source_row: Number.isInteger(item.sourceRow) ? item.sourceRow : null,
  };
  if (code && !f.external_code) issues.push(issue("error", "invalid_code", `El código «${code.slice(0, 20)}» no es válido (letras, números, punto o guion).`));

  const title = clean(item.title, TITLE_MAX + 1);
  if (!title) issues.push(issue("error", "missing_title", "Falta el título."));
  else if (title.length > TITLE_MAX) { f.title = title.slice(0, TITLE_MAX); issues.push(issue("warning", "title_truncated", `El título se acortó a ${TITLE_MAX} caracteres.`)); }
  else f.title = title;

  if (!item.date || !parseYmd(String(item.date))) issues.push(issue("error", "invalid_date", item.date ? `La fecha «${String(item.date).slice(0, 20)}» no es válida.` : "Falta la fecha."));
  else f.scheduled_date = String(item.date);

  if (item.time != null && item.time !== "") {
    const t = validTime(item.time);
    if (t) f.scheduled_time = t;
    else issues.push(issue("error", "invalid_time", `La hora «${String(item.time).slice(0, 10)}» no es válida (HH:MM).`));
  }

  if (!f.format) issues.push(issue("error", "unmapped_format", "Falta el formato."));
  else {
    f.content_type = formatToType(f.format);
    if (!f.content_type) issues.push(issue("error", "unmapped_format", `El formato «${f.format}» no tiene un tipo equivalente en Stroka.`));
  }

  if (item.platform != null && String(item.platform).trim() !== "") {
    f.platform = platformKey(item.platform);
    if (!f.platform) issues.push(issue("error", "invalid_platform", `La plataforma «${String(item.platform).slice(0, 30)}» no es válida.`));
  }
  return { fields: f, issues };
}

export const monthOf = (date) => (date ? String(date).slice(0, 7) : null);

// Internal notes keep only the free detail of the piece. Code lives in
// planning_content_links; pillar and CTA are structured columns of content_items.
export function buildInternalNotes({ detail }) {
  return detail || null;
}

// The Studio fields a planning item would write. Used to create, to compare and to update.
export function desiredContent(item, { defaultPlatform, defaultTime }) {
  return {
    title: item.title,
    content_type: item.content_type,
    platform: item.platform || defaultPlatform,
    scheduled_at: scheduledInstant(item.scheduled_date, item.scheduled_time, defaultTime)?.toISOString() ?? null,
    internal_notes: buildInternalNotes(item),
    pillar: item.pillar || null,
    cta: item.cta || null,
  };
}
export const TRACKED_FIELDS = ["title", "content_type", "platform", "scheduled_at", "internal_notes", "pillar", "cta"];
