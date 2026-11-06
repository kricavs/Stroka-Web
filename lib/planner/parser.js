// Deterministic parser for the Stroka planning workbook (template v1, e.g. the
// Torquen monthly calendar). No AI, no positional columns: sheets are recognised
// by their HEADERS and columns by normalised header names, so sheet order, sheet
// names, extra columns and spacing/accent variants do not matter.
//
//   Calendario  (Fecha · Formato · Cód. · Título / Idea · Pilar · CTA …)   → one item per row
//   Reels / Carruseles / Historias (Cód. · Título · Descripción · Pilar · CTA) → details joined by code
//   Notas (Tema · Detalle)                                                  → context, never items
//
// Output items follow PlanningItemInput (see ./rules.js), the same shape an AI
// or MCP source must produce. Structural findings travel in `warnings`.
import { XlsxError, readXlsx } from "./xlsx-reader.js";
import { MAX_ITEMS } from "./limits.js";
import { normText, parseDateText, serialToDateTime, validTime } from "./rules.js";

export const TEMPLATE_ID = "stroka-planning-v1";

const ALIASES = {
  calendar: {
    date: ["fecha"], weekday: ["dia"], week: ["semana"], format: ["formato", "tipo"], code: ["cod", "codigo"],
    title: ["titulo idea", "titulo", "idea"], pillar: ["pilar"], cta: ["cta"], platform: ["plataforma", "red social", "red"], time: ["hora", "horario"],
  },
  details: {
    code: ["cod", "codigo"], title: ["titulo", "nombre"], detail: ["descripcion enfoque", "descripcion", "enfoque"],
    pillar: ["pilar"], cta: ["cta", "formato cta", "llamado a la accion"],
  },
  notes: { topic: ["tema"], detail: ["detalle"] },
};

const issue = (level, code, text) => ({ level, code, text });
const WEEKDAY = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 0 };
// Note topics too generic to be a content keyword.
const GENERIC_TOPICS = new Set(["periodo", "dias de trabajo", "datos tecnicos", "guiones reutilizados", "feriados", "pendientes", "regla del proyecto", "observaciones", "notas", "contexto"]);

const text = (c) => {
  if (!c) return "";
  if (c.kind === "str") return c.v.trim();
  if (c.kind === "num") return String(c.v);
  if (c.kind === "bool") return c.v ? "TRUE" : "FALSE";
  return "";
};

function headerMap(row, aliases) {
  const cols = {};
  let hits = 0;
  row.cells.forEach((c, i) => {
    if (!c || c.kind !== "str") return;
    const key = normText(c.v);
    for (const [field, names] of Object.entries(aliases)) {
      if (cols[field] === undefined && names.includes(key)) { cols[field] = i; hits++; break; }
    }
  });
  return { cols, hits };
}

// Looks at the first rows for the best header row of a role.
function findHeader(sheet, role) {
  let best = null;
  for (const row of sheet.rows.slice(0, 10)) {
    const h = headerMap(row, ALIASES[role]);
    if (!best || h.hits > best.hits) best = { ...h, row };
  }
  return best;
}

function classify(sheet) {
  const cal = findHeader(sheet, "calendar");
  if (cal && cal.cols.date !== undefined && cal.cols.format !== undefined && cal.cols.title !== undefined) return { role: "calendar", header: cal };
  const notes = findHeader(sheet, "notes");
  if (notes && notes.cols.topic !== undefined && notes.cols.detail !== undefined && notes.hits === 2) return { role: "notes", header: notes };
  const det = findHeader(sheet, "details");
  if (det && det.cols.code !== undefined && det.cols.title !== undefined && det.hits >= 3) return { role: "details", header: det };
  return { role: "unknown" };
}

const cell = (row, cols, f) => (cols[f] === undefined ? null : row.cells[cols[f]] ?? null);
const blank = (row) => row.cells.every((c) => !c || (c.kind === "str" && !c.v.trim()));

function dateFrom(c) {
  if (!c) return null;
  if (c.kind === "date" || (c.kind === "num" && c.v >= 20000 && c.v <= 80000)) return serialToDateTime(c.v);
  if (c.kind === "str") return parseDateText(c.v);
  return null;
}

function timeFrom(c) {
  if (!c) return null;
  if (c.kind === "str") return validTime(c.v.trim());
  if (c.kind === "date" || c.kind === "num") {
    if (c.v > 0 && c.v < 1) { const d = serialToDateTime(1 + c.v); return d?.time ?? null; }
  }
  return null;
}

export function parseNotes(sheet, header) {
  const out = [];
  for (const row of sheet.rows) {
    if (row.r <= header.row.r || blank(row)) continue;
    const topic = text(cell(row, header.cols, "topic"));
    const detail = text(cell(row, header.cols, "detail"));
    if (topic || detail) out.push({ topic, detail, sourceRow: row.r });
  }
  return out;
}

function noteRules(notes) {
  // Explicit, checkable rule only: a note that says Sundays are not scheduled/published.
  const noSundays = notes.some((n) => {
    const t = normText(`${n.topic} ${n.detail}`);
    return /domingo/.test(t) && /\b(no se (programa|publica|publican)|no publicar|sin publicar|no programar)\b/.test(t);
  });
  const topics = notes
    .map((n) => ({ topic: n.topic, key: normText(n.topic) }))
    .filter((t) => t.key.length >= 6 && !GENERIC_TOPICS.has(t.key));
  return { noSundays, topics };
}

/**
 * @param {Uint8Array|Buffer} buffer  .xlsx bytes (never stored)
 * @returns {{ template, period, items, notes, issues, stats, ignored }}
 * Throws XlsxError for unreadable/unsafe files and for files that are not the template.
 */
export function parsePlanningWorkbook(buffer) {
  const wb = readXlsx(buffer);
  const roles = wb.sheets.map((s) => ({ sheet: s, ...classify(s) }));
  const calendars = roles.filter((r) => r.role === "calendar");
  if (!calendars.length) throw new XlsxError("no_template", "No se reconoció la plantilla: falta una hoja con las columnas Fecha, Formato y Título.");
  if (calendars.length > 1) throw new XlsxError("ambiguous_calendar", "Hay más de una hoja que parece el calendario. Dejá solo una.");
  const cal = calendars[0];
  const detailSheets = roles.filter((r) => r.role === "details");
  const notesSheet = roles.find((r) => r.role === "notes");
  const issues = [];
  const ignored = [...wb.ignored];
  for (const r of roles.filter((x) => x.role === "unknown")) ignored.push(`hoja «${r.sheet.name}» (no reconocida)`);
  if (ignored.length) issues.push(issue("warning", "ignored_parts", `Se ignoró: ${ignored.join(", ")}.`));

  const notes = notesSheet ? parseNotes(notesSheet.sheet, notesSheet.header) : [];
  const rules = noteRules(notes);

  // details by code (duplicates are ambiguous, not "last wins")
  const details = new Map();
  const dupDetail = new Set();
  for (const d of detailSheets) {
    for (const row of d.sheet.rows) {
      if (row.r <= d.header.row.r || blank(row)) continue;
      const code = text(cell(row, d.header.cols, "code")).toUpperCase();
      if (!code) { issues.push(issue("warning", "detail_without_code", `«${d.sheet.name}» fila ${row.r}: tiene datos pero no código; se ignoró.`)); continue; }
      if (details.has(code)) dupDetail.add(code);
      details.set(code, {
        title: text(cell(row, d.header.cols, "title")), detail: text(cell(row, d.header.cols, "detail")),
        pillar: text(cell(row, d.header.cols, "pillar")), cta: text(cell(row, d.header.cols, "cta")), sheet: d.sheet.name, row: row.r,
      });
    }
  }
  const hasDetails = detailSheets.length > 0;

  // calendar rows
  const rows = cal.sheet.rows.filter((r) => r.r > cal.header.row.r && !blank(r));
  const items = [];
  const codeRows = new Map();
  for (const row of rows) {
    const c = cal.header.cols;
    const fmt = text(cell(row, c, "format"));
    const title = text(cell(row, c, "title"));
    const code = text(cell(row, c, "code")).toUpperCase();
    const dateCell = cell(row, c, "date");
    // separator rows ("Semana 2") carry none of the essentials
    if (!fmt && !title && !code && !dateCell) continue;
    const w = [];
    const sheetName = cal.sheet.name;

    if (row.cells.some((x) => x && x.formula)) w.push(issue("warning", "formula", "Hay una fórmula en la fila: se usó su último valor guardado (no se recalcula)."));
    if (row.cells.some((x) => x && x.kind === "err")) w.push(issue("error", "cell_error", "Hay una celda con error de Excel (#REF!, #N/A…)."));

    const dt = dateFrom(dateCell);
    if (!dateCell) w.push(issue("error", "invalid_date", "Falta la fecha."));
    else if (!dt) w.push(issue("error", "invalid_date", `La fecha «${text(dateCell).slice(0, 20)}» no es válida.`));

    const titleCell = cell(row, c, "title");
    if (titleCell && titleCell.kind !== "str") w.push(issue("warning", "unexpected_type", "El título no era texto; se convirtió."));

    let item = {
      date: dt?.date ?? null,
      time: timeFrom(cell(row, c, "time")) || dt?.time || null,
      externalCode: code || null,
      format: fmt, title,
      detail: "", pillar: text(cell(row, c, "pillar")), cta: text(cell(row, c, "cta")),
      platform: text(cell(row, c, "platform")) || null,
      sourceSheet: sheetName, sourceRow: row.r, warnings: w,
    };

    if (cell(row, c, "weekday") && dt?.date) {
      const wd = WEEKDAY[normText(text(cell(row, c, "weekday"))).slice(0, 3)];
      const real = new Date(`${dt.date}T12:00:00Z`).getUTCDay();
      if (wd !== undefined && wd !== real) w.push(issue("warning", "weekday_mismatch", `La columna Día dice «${text(cell(row, c, "weekday"))}» pero la fecha cae otro día de la semana.`));
    }
    if (rules.noSundays && dt?.date && new Date(`${dt.date}T12:00:00Z`).getUTCDay() === 0) w.push(issue("warning", "sunday", "Cae domingo y las notas indican no publicar domingos."));

    if (!code) {
      w.push(hasDetails ? issue("error", "missing_code", "Falta el código, necesario para unir el detalle de las otras hojas.") : issue("warning", "no_code", "Sin código: no se podrá actualizar en una reimportación."));
    } else {
      codeRows.set(code, [...(codeRows.get(code) || []), item]);
      if (hasDetails) {
        const d = details.get(code);
        if (!d) w.push(issue("warning", "code_not_in_details", `El código ${code} no figura en las hojas de detalle.`));
        else if (dupDetail.has(code)) w.push(issue("error", "ambiguous_detail", `El código ${code} está repetido en las hojas de detalle.`));
        else {
          item.detail = d.detail;
          if (!item.pillar) item.pillar = d.pillar;
          else if (d.pillar && normText(d.pillar) !== normText(item.pillar)) w.push(issue("warning", "pillar_mismatch", `El pilar difiere entre Calendario («${item.pillar}») y «${d.sheet}» («${d.pillar}»).`));
          if (!item.cta) item.cta = d.cta;
          else if (d.cta && normText(d.cta) !== normText(item.cta)) w.push(issue("warning", "cta_mismatch", `El CTA difiere entre Calendario y «${d.sheet}».`));
          if (!item.title && d.title) { item.title = d.title; w.push(issue("warning", "title_from_detail", "El título salió de la hoja de detalle.")); }
          item.detailSource = { sheet: d.sheet, row: d.row, title: d.title };
        }
      }
    }

    // note-derived, deterministic references: a note topic named inside the piece's own text
    const hay = normText(`${item.title} ${item.detail} ${item.cta}`);
    for (const t of rules.topics) if (hay.includes(t.key)) w.push(issue("warning", "note_reference", `Menciona «${t.topic}»: revisá esa nota del mes antes de aplicar.`));

    items.push(item);
  }

  for (const [code, list] of codeRows) {
    if (list.length > 1) for (const it of list) it.warnings.push(issue("error", "duplicate_code", `El código ${code} aparece ${list.length} veces en el calendario.`));
  }
  if (items.length > MAX_ITEMS) throw new XlsxError("too_many_items", `El calendario tiene demasiadas piezas (máximo ${MAX_ITEMS}).`);
  if (!items.length) issues.push(issue("error", "empty", "El calendario no tiene piezas."));

  const unused = [...details.keys()].filter((k) => !codeRows.has(k));
  if (unused.length) issues.push(issue("warning", "unused_detail", `Hay detalles que no aparecen en el calendario: ${unused.slice(0, 12).join(", ")}${unused.length > 12 ? "…" : ""}.`));

  // period = the month most dates fall in
  const counts = new Map();
  for (const it of items) if (it.date) counts.set(it.date.slice(0, 7), (counts.get(it.date.slice(0, 7)) || 0) + 1);
  const period = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  const formats = {};
  for (const it of items) formats[it.format || "—"] = (formats[it.format || "—"] || 0) + 1;
  return {
    template: TEMPLATE_ID, period, items, notes, issues, ignored,
    stats: { items: items.length, formats, detailSheets: detailSheets.map((d) => d.sheet.name), notes: notes.length, details: details.size },
  };
}
