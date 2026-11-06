// Planning drafts, db-injected (pg, PGlite, tests). One path for every source:
//
//   Excel ───────┐
//   AI (5B) ─────┼→ createPlanningDraft → review/edit → applyPlanningDraft → content_items
//   Claude/MCP ──┘        (same PlanningItemInput shape, see ./rules.js)
//
// NOTHING here writes to content_items until applyPlanningDraft, which runs in a
// single transaction. Re-imports are recognised through planning_content_links
// (client + month + external code → content) and compared against a snapshot of
// what the plan last wrote, so manual work in Studio is never overwritten silently.
//
// Operations an MCP server will later expose map 1:1 to the exports below:
//   getClientPlanningContext · getPlanningMonth · createPlanningDraft ·
//   updatePlanningDraftItem · applyPlanningDraft (+ cancelPlanningDraft, getPlanningDraft)
import { logActivity, newId } from "../portal/activity-core.js";
import { monthRange, ymd } from "../shared/time.js";
import { InputError } from "../studio/errors.js";
import { MAX_ITEMS } from "./limits.js";
import * as R from "./rules.js";

const ACTOR = { actorType: "admin", actorName: "Stroka" };
const CLIENT_FACING = ["title", "platform", "content_type", "scheduled_at"];
// Findings re-derived from the stored fields on every analysis; never trusted from the source.
const DERIVED_CODES = new Set(["invalid_date", "invalid_time", "unmapped_format", "missing_title", "invalid_platform", "invalid_code", "duplicate_code", "month_mismatch", "title_truncated"]);

const iso = (v) => (v ? new Date(v).toISOString() : null);
const eq = (a, b) => (a ?? null) === (b ?? null) || (a === "" && b == null) || (b === "" && a == null);
const pickTracked = (o) => Object.fromEntries(R.TRACKED_FIELDS.map((f) => [f, o[f] ?? null]));
const trackedOfContent = (c) => ({ ...pickTracked({ ...c, scheduled_at: iso(c.scheduled_at) }), status: c.status, version: c.version });
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---- creation -------------------------------------------------------------

/**
 * @param {object} input
 *   sourceType 'xlsx'|'ai'|'mcp'|'manual', clientId, items: PlanningItemInput[],
 *   defaultPlatform (REQUIRED, never inferred), defaultContentStatus ('production' default),
 *   defaultTime ('12:00' default), period? ('YYYY-MM', else the most common month),
 *   notes? [{topic, detail}], sourceName?, sourceHash? (sha-256 hex), issues? (workbook-level), createdBy?
 */
export async function createPlanningDraft(db, input) {
  const sourceType = String(input.sourceType || "");
  if (!R.SOURCE_TYPES.includes(sourceType)) throw new InputError("Origen de planificación inválido.");
  const clientId = String(input.clientId || "");
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new InputError("La planificación no tiene piezas.");
  if (items.length > MAX_ITEMS) throw new InputError(`La planificación tiene demasiadas piezas (máximo ${MAX_ITEMS}).`);

  const defaultPlatform = R.platformKey(input.defaultPlatform);
  if (!defaultPlatform) throw new InputError("Elegí la plataforma por defecto.");
  const status = input.defaultContentStatus ?? R.DEFAULT_IMPORT_STATUS;
  if (!R.IMPORT_STATUSES.some(([k]) => k === status)) throw new InputError("Estado inicial inválido.");
  const defaultTime = input.defaultTime ? R.validTime(input.defaultTime) : R.DEFAULT_TIME;
  if (!defaultTime) throw new InputError("Hora por defecto inválida (HH:MM).");
  const hash = input.sourceHash == null ? null : String(input.sourceHash);
  if (hash !== null && !/^[0-9a-f]{64}$/.test(hash)) throw new InputError("Huella del archivo inválida.");

  let period = input.period ? String(input.period) : null;
  if (!period) {
    const counts = new Map();
    for (const it of items) {
      const m = it?.date ? R.monthOf(String(it.date)) : null;
      if (m && MONTH.test(m)) counts.set(m, (counts.get(m) || 0) + 1);
    }
    period = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  }
  if (!period || !MONTH.test(period)) throw new InputError("No se pudo determinar el mes de la planificación.");

  const notes = (Array.isArray(input.notes) ? input.notes : []).slice(0, 100)
    .map((n) => ({ topic: String(n?.topic ?? "").trim().slice(0, 120), detail: String(n?.detail ?? "").trim().slice(0, 2000) }))
    .filter((n) => n.topic || n.detail);
  const wbIssues = (Array.isArray(input.issues) ? input.issues : []).slice(0, 50)
    .map((i) => ({ level: i.level === "error" ? "error" : "warning", code: String(i.code || "note").slice(0, 40), text: String(i.text || "").slice(0, 400) }));

  const id = newId("pld");
  const previous = await db.tx(async (t) => {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    const prev = hash
      ? await t.query(`SELECT id, status, created_at, applied_at, source_name FROM planning_drafts WHERE client_id = $1 AND source_hash = $2 ORDER BY created_at DESC LIMIT 5`, [clientId, hash])
      : [];
    await t.query(
      `INSERT INTO planning_drafts (id, client_id, source_type, source_name, source_hash, period_month, default_platform,
                                    default_content_status, default_time, notes, issues, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)`,
      [id, clientId, sourceType, input.sourceName ? String(input.sourceName).slice(0, 200) : null, hash, period, defaultPlatform, status, defaultTime,
       JSON.stringify(notes), JSON.stringify(wbIssues), input.createdBy ? String(input.createdBy).slice(0, 80) : "Stroka"]
    );
    const itemRows = items.map((raw, pos) => {
      const { fields: f } = R.validatePlanningItem(raw || {});
      const source = (Array.isArray(raw?.warnings) ? raw.warnings : []).filter((w) => w && w.code && !DERIVED_CODES.has(w.code))
        .map((w) => ({ level: w.level === "error" ? "error" : "warning", code: String(w.code).slice(0, 40), text: String(w.text || "").slice(0, 300) }));
      const rawData = {
        sourceWarnings: source, detailSource: raw?.detailSource || null,
        rawDate: raw?.date != null ? String(raw.date).slice(0, 40) : null, rawTime: raw?.time != null ? String(raw.time).slice(0, 10) : null,
        rawCode: raw?.externalCode != null ? String(raw.externalCode).slice(0, 40) : null, rawTitle: raw?.title != null ? String(raw.title).slice(0, 400) : null,
        rawPlatform: raw?.platform != null ? String(raw.platform).slice(0, 40) : null,
      };
      return [newId("pli"), id, clientId, pos, f.external_code, f.scheduled_date, f.scheduled_time, f.format, f.content_type, f.platform,
        f.title, f.detail, f.pillar, f.cta, f.source_sheet, f.source_row, JSON.stringify(rawData)];
    });
    await insertMany(t, "planning_draft_items",
      ["id", "draft_id", "client_id", "position", "external_code", "scheduled_date", "scheduled_time", "format", "content_type", "platform", "title", "detail", "pillar", "cta", "source_sheet", "source_row", "raw_data"],
      itemRows, { casts: Array(16).fill("").concat("::jsonb") });
    await analyzeDraft(t, clientId, id);
    return prev;
  });
  const [d] = await db.query(`SELECT summary FROM planning_drafts WHERE id = $1`, [id]);
  return { id, summary: d.summary, previous: previous.map((p) => ({ id: p.id, status: p.status, createdAt: iso(p.created_at), appliedAt: iso(p.applied_at), sourceName: p.source_name })) };
}

// Multi-row INSERT helper: one round trip instead of one per row (Neon latency makes loops expensive).
// `rows` are arrays of already-ordered params; `casts` optionally types each column ("::jsonb").
async function insertMany(q, table, columns, rows, { casts = [], suffix = "" } = {}) {
  if (!rows.length) return;
  const n = columns.length;
  const values = rows.map((_, r) => `(${columns.map((_c, c) => `$${r * n + c + 1}${casts[c] || ""}`).join(",")})`).join(",");
  await q.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values}${suffix}`, rows.flat());
}

// ---- analysis ---------------------------------------------------------------

const rowInput = (r) => {
  const raw = r.raw_data || {};
  return {
    date: r.date_str ?? raw.rawDate ?? null, time: r.scheduled_time ?? raw.rawTime ?? null,
    externalCode: r.external_code ?? raw.rawCode ?? null, format: r.format, title: r.title || raw.rawTitle || "",
    detail: r.detail, pillar: r.pillar, cta: r.cta, platform: r.platform ?? raw.rawPlatform ?? null, warnings: raw.sourceWarnings || [],
  };
};

const outcomeOf = (it) => {
  if (it.skipped) return "skip";
  if (it.validation_status === "error") return "blocked";
  switch (it.computed) {
    case "create": return "create";
    case "possible_duplicate": return it.resolution === "create" ? "create" : "skip";
    case "update": return "update";
    case "conflict": return it.resolution === "excel" ? "update" : it.resolution === "studio" ? "skip" : "unresolved";
    default: return "no_change";
  }
};

/**
 * Recomputes issues, matches every item against Studio and refreshes the draft summary.
 * `q` is the db or a tx. With { lock } the linked content rows are locked (apply).
 */
export async function analyzeDraft(q, clientId, draftId, { lock = false } = {}) {
  const [draft] = await q.query(`SELECT * FROM planning_drafts WHERE id = $1 AND client_id = $2`, [draftId, clientId]);
  if (!draft) throw new InputError("Planificación no encontrada.", 404);
  const rows = await q.query(
    `SELECT *, to_char(scheduled_date,'YYYY-MM-DD') AS date_str FROM planning_draft_items WHERE draft_id = $1 ORDER BY position`, [draftId]);

  const codeCount = new Map();
  for (const r of rows) if (r.external_code) codeCount.set(r.external_code, (codeCount.get(r.external_code) || 0) + 1);

  const links = new Map(
    (await q.query(
      `SELECT l.external_code, l.snapshot, l.ack, c.id AS content_id, c.title, c.content_type, c.platform, c.scheduled_at, c.internal_notes, c.pillar, c.cta, c.status, c.version
         FROM planning_content_links l JOIN content_items c ON c.id = l.content_id AND c.client_id = l.client_id
        WHERE l.client_id = $1 AND l.period_month = $2${lock ? " FOR UPDATE OF c" : ""}`,
      [clientId, draft.period_month]
    )).map((l) => [l.external_code, l])
  );
  const mr = monthRange(draft.period_month);
  const candidates = await q.query(
    `SELECT id, title, content_type, scheduled_at FROM content_items
      WHERE client_id = $1 AND status <> 'cancelled' AND scheduled_at >= $2 AND scheduled_at < $3
        AND id NOT IN (SELECT content_id FROM planning_content_links WHERE client_id = $1)`,
    [clientId, mr.start, mr.end]
  );

  const ctx = { defaultPlatform: draft.default_platform, defaultTime: draft.default_time };
  const items = [];
  for (const r of rows) {
    const { fields, issues } = R.validatePlanningItem(rowInput(r));
    if (fields.scheduled_date && R.monthOf(fields.scheduled_date) !== draft.period_month) {
      issues.push({ level: "error", code: "month_mismatch", text: `La fecha ${fields.scheduled_date} no es de ${draft.period_month}: el mes de la planificación.` });
    }
    if (r.external_code && codeCount.get(r.external_code) > 1) {
      issues.push({ level: "error", code: "duplicate_code", text: `El código ${r.external_code} aparece ${codeCount.get(r.external_code)} veces: es ambiguo.` });
    }
    const status = issues.some((i) => i.level === "error") ? "error" : issues.length ? "warning" : "valid";

    // match against Studio
    let computed = "create";
    let target = null;
    const analysis = {};
    const canMatch = fields.scheduled_date && fields.content_type && fields.title;
    if (canMatch) {
      const desired = R.desiredContent({ ...fields, platform: fields.platform }, ctx);
      analysis.excel = desired;
      const link = fields.external_code ? links.get(fields.external_code) : null;
      if (link) {
        const cur = trackedOfContent(link);
        const base = link.snapshot || {};
        const manual = R.TRACKED_FIELDS.some((f) => !eq(cur[f], base[f])) || cur.status !== base.status || cur.version !== base.version;
        const diff = R.TRACKED_FIELDS.filter((f) => !eq(cur[f], desired[f]));
        target = link.content_id;
        Object.assign(analysis, { matchKind: "link", current: cur, diff, manual });
        // The plan only "speaks" when it changed since it last wrote: if it still says what it said, Studio's edits stand.
        const excelUnchanged = R.TRACKED_FIELDS.every((f) => eq(base[f], desired[f]));
        if (!diff.length) computed = "no_change";
        else if (excelUnchanged) { computed = "no_change"; analysis.excelUnchanged = true; }
        else if (link.ack && R.TRACKED_FIELDS.every((f) => eq(link.ack[f], desired[f]))) { computed = "no_change"; analysis.ackedStudio = true; }
        else computed = manual ? "conflict" : "update";
      } else {
        const day = fields.scheduled_date;
        const dup = candidates.find((c) => c.content_type === fields.content_type && iso(c.scheduled_at) && dayOfInstant(c.scheduled_at) === day
          && (R.normText(c.title) === R.normText(fields.title) || R.similarity(c.title, fields.title) >= 0.8));
        if (dup) { computed = "possible_duplicate"; target = dup.id; Object.assign(analysis, { matchKind: "duplicate", duplicateTitle: dup.title }); }
      }
    }
    const resolution = computed === "conflict" || computed === "possible_duplicate" ? r.resolution : null;
    items.push({ ...r, ...fields, issues, validation_status: status, computed, resolution, target, analysis });
  }

  // links of this month that this plan no longer mentions (informational: never deleted)
  const present = new Set(items.map((i) => i.external_code).filter(Boolean));
  const orphans = [...links.keys()].filter((c) => !present.has(c));

  const summary = { items: items.length, create: 0, update: 0, skip: 0, noChange: 0, unresolvedConflicts: 0, duplicatesSkipped: 0, errors: 0, warnings: 0, formats: {}, orphans: orphans.length };
  for (const it of items) {
    const out = outcomeOf(it);
    if (out === "create") summary.create++;
    else if (out === "update") summary.update++;
    else if (out === "no_change") summary.noChange++;
    else if (out === "skip") { summary.skip++; if (!it.skipped && it.computed === "possible_duplicate") summary.duplicatesSkipped++; }
    else if (out === "unresolved") summary.unresolvedConflicts++;
    if (it.validation_status === "error" && !it.skipped) summary.errors++;
    if (it.validation_status === "warning") summary.warnings++;
    summary.formats[it.format || "—"] = (summary.formats[it.format || "—"] || 0) + 1;
  }

  if (draft.status !== "draft") return { draft, items, summary, orphans }; // history is never rewritten
  if (items.length) {
    // one UPDATE for the whole draft
    const rows = items.map((it) => ({
      id: it.id, issues: it.issues, validation_status: it.validation_status, action: it.skipped ? "skip" : it.computed, resolution: it.resolution,
      target: it.target, analysis: { ...it.analysis, computed: it.computed }, content_type: it.content_type, external_code: it.external_code,
    }));
    await q.query(
      `UPDATE planning_draft_items p SET issues = x.issues, validation_status = x.validation_status, action = x.action, resolution = x.resolution,
              target_content_id = x.target, analysis = x.analysis, content_type = x.content_type, external_code = x.external_code
         FROM jsonb_to_recordset($1::jsonb) AS x(id text, issues jsonb, validation_status text, action text, resolution text, target text,
                                                 analysis jsonb, content_type text, external_code text)
        WHERE p.id = x.id`,
      [JSON.stringify(rows)]
    );
  }
  await q.query(`UPDATE planning_drafts SET summary = $2::jsonb WHERE id = $1`, [draftId, JSON.stringify(summary)]);
  return { draft, items, summary, orphans };
}

// 'YYYY-MM-DD' of an instant in the business zone (candidates come from the db as Dates).
const dayOfInstant = (d) => ymd(new Date(d));

// ---- reading ------------------------------------------------------------------

const publicItem = (r) => ({
  id: r.id, position: r.position, externalCode: r.external_code, date: r.date_str, time: r.scheduled_time, format: r.format, contentType: r.content_type,
  platform: r.platform, title: r.title, detail: r.detail, pillar: r.pillar, cta: r.cta, sourceSheet: r.source_sheet, sourceRow: r.source_row,
  validationStatus: r.validation_status, issues: r.issues || [], action: r.action, skipped: r.skipped, resolution: r.resolution,
  targetContentId: r.target_content_id, analysis: r.analysis || {}, appliedSnapshot: r.applied_snapshot || null,
});

export async function getPlanningDraft(db, clientId, draftId) {
  const [d] = await db.query(
    `SELECT d.*, c.name AS client_name FROM planning_drafts d JOIN clients c ON c.id = d.client_id WHERE d.id = $1 AND d.client_id = $2`, [draftId, clientId]);
  if (!d) throw new InputError("Planificación no encontrada.", 404);
  const rows = await db.query(`SELECT *, to_char(scheduled_date,'YYYY-MM-DD') AS date_str FROM planning_draft_items WHERE draft_id = $1 ORDER BY position`, [draftId]);
  const present = new Set(rows.map((r) => r.external_code).filter(Boolean));
  const orphans = (await db.query(
    `SELECT l.external_code, c.id AS content_id, c.title FROM planning_content_links l JOIN content_items c ON c.id = l.content_id AND c.client_id = l.client_id
      WHERE l.client_id = $1 AND l.period_month = $2 ORDER BY l.external_code`, [clientId, d.period_month]
  )).filter((o) => !present.has(o.external_code)).map((o) => ({ code: o.external_code, contentId: o.content_id, title: o.title }));
  const previous = d.source_hash
    ? (await db.query(`SELECT id, status, created_at, applied_at FROM planning_drafts WHERE client_id = $1 AND source_hash = $2 AND id <> $3 ORDER BY created_at DESC LIMIT 5`, [clientId, d.source_hash, draftId]))
        .map((p) => ({ id: p.id, status: p.status, createdAt: iso(p.created_at), appliedAt: iso(p.applied_at) }))
    : [];
  return {
    id: d.id, clientId: d.client_id, clientName: d.client_name, sourceType: d.source_type, sourceName: d.source_name, period: d.period_month, status: d.status,
    defaultPlatform: d.default_platform, defaultContentStatus: d.default_content_status, defaultTime: d.default_time,
    summary: d.summary, notes: d.notes, issues: d.issues, createdAt: iso(d.created_at), appliedAt: iso(d.applied_at), cancelledAt: iso(d.cancelled_at),
    items: rows.map(publicItem), orphans, previous,
  };
}

// Import history of a client (audit).
export async function listPlanningDrafts(db, clientId, { limit = 30 } = {}) {
  const rows = await db.query(
    `SELECT id, source_type, source_name, period_month, status, summary, created_at, applied_at, cancelled_at
       FROM planning_drafts WHERE client_id = $1 ORDER BY created_at DESC LIMIT $2`, [clientId, limit]);
  return rows.map((r) => ({ id: r.id, sourceType: r.source_type, sourceName: r.source_name, period: r.period_month, status: r.status, summary: r.summary,
    createdAt: iso(r.created_at), appliedAt: iso(r.applied_at), cancelledAt: iso(r.cancelled_at) }));
}

// ---- editing ------------------------------------------------------------------

const EDITABLE = { date: "scheduled_date", time: "scheduled_time", format: "format", title: "title", detail: "detail", pillar: "pillar", cta: "cta", platform: "platform" };

export async function updatePlanningDraftItem(db, clientId, draftId, itemId, patch) {
  return db.tx(async (t) => {
    const [d] = await t.query(`SELECT status FROM planning_drafts WHERE id = $1 AND client_id = $2 FOR UPDATE`, [draftId, clientId]);
    if (!d) throw new InputError("Planificación no encontrada.", 404);
    if (d.status !== "draft") throw new InputError("Esta planificación ya no se puede editar.", 409);
    const [it] = await t.query(`SELECT id, raw_data FROM planning_draft_items WHERE id = $1 AND draft_id = $2 AND client_id = $3`, [itemId, draftId, clientId]);
    if (!it) throw new InputError("Pieza no encontrada.", 404);

    const sets = [];
    const params = [itemId];
    const raw = { ...(it.raw_data || {}) };
    const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    for (const [k, col] of Object.entries(EDITABLE)) {
      if (patch[k] === undefined) continue;
      let v = patch[k] === null ? null : String(patch[k]).trim();
      if (v === "") v = null;
      if (k === "date") {
        // an invalid date is kept as text so the preview can say so, instead of failing the edit
        raw.rawDate = v ? v.slice(0, 40) : null;
        const p = v ? R.parseDateText(v) : null;
        add(col, p ? p.date : null);
        continue;
      }
      if (k === "time") { raw.rawTime = v; add(col, v && R.validTime(v) ? R.validTime(v) : null); continue; }
      if (k === "platform") { raw.rawPlatform = v; add(col, v ? R.platformKey(v) : null); continue; }
      if (k === "title") { raw.rawTitle = v; add(col, v ? v.slice(0, 400) : ""); continue; }
      if (k === "format") { add(col, v || ""); continue; }
      add(col, v);
    }
    if (patch.skipped !== undefined) add("skipped", Boolean(patch.skipped));
    if (patch.resolution !== undefined) {
      if (patch.resolution !== null && !["studio", "excel", "create", "skip"].includes(patch.resolution)) throw new InputError("Resolución inválida.");
      add("resolution", patch.resolution);
    }
    if (!sets.length) throw new InputError("Nada para actualizar.");
    params.push(JSON.stringify(raw));
    sets.push(`raw_data = $${params.length}::jsonb`);
    await t.query(`UPDATE planning_draft_items SET ${sets.join(", ")} WHERE id = $1`, params);
    const out = await analyzeDraft(t, clientId, draftId);
    return { summary: out.summary };
  });
}

export async function cancelPlanningDraft(db, clientId, draftId) {
  return db.tx(async (t) => {
    const [d] = await t.query(`SELECT status FROM planning_drafts WHERE id = $1 AND client_id = $2 FOR UPDATE`, [draftId, clientId]);
    if (!d) throw new InputError("Planificación no encontrada.", 404);
    if (d.status !== "draft") throw new InputError(d.status === "applied" ? "Esta planificación ya fue aplicada." : "Esta planificación ya estaba cancelada.", 409);
    await t.query(`UPDATE planning_drafts SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [draftId]);
    return { status: "cancelled" };
  });
}

// ---- apply ----------------------------------------------------------------------

/**
 * Applies the reviewed draft to the calendar. ONE transaction: all or nothing.
 * Blocks on errors and on unresolved conflicts; warnings never block.
 */
export async function applyPlanningDraft(db, clientId, draftId) {
  return db.tx(async (t) => {
    const [p] = await t.query(`SELECT period_month FROM planning_drafts WHERE id = $1 AND client_id = $2`, [draftId, clientId]);
    if (!p) throw new InputError("Planificación no encontrada.", 404);
    // Two DIFFERENT drafts of the same client+month (e.g. the same file imported twice) have no link row to
    // serialize on yet and would both "create" the same pieces. One lock per client+month closes that gap.
    await t.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`planning:${clientId}:${p.period_month}`]);
    const [d] = await t.query(`SELECT * FROM planning_drafts WHERE id = $1 AND client_id = $2 FOR UPDATE`, [draftId, clientId]);
    if (!d) throw new InputError("Planificación no encontrada.", 404);
    if (d.status !== "draft") throw new InputError(d.status === "applied" ? "Esta planificación ya fue aplicada." : "Esta planificación fue cancelada.", 409);

    // fresh view of Studio, with linked contents locked until commit
    const { items, summary } = await analyzeDraft(t, clientId, draftId, { lock: true });
    const bad = items.filter((i) => !i.skipped && i.validation_status === "error");
    if (bad.length) throw new InputError(`Hay ${bad.length} ${bad.length === 1 ? "pieza con errores" : "piezas con errores"}. Corregilas u omitilas antes de aplicar.`, 422);
    const open = items.filter((i) => outcomeOf(i) === "unresolved");
    if (open.length) throw new InputError(`Hay ${open.length} ${open.length === 1 ? "conflicto sin resolver" : "conflictos sin resolver"}: elegí Studio o Excel en cada uno.`, 409);

    const ctx = { defaultPlatform: d.default_platform, defaultTime: d.default_time };
    const done = { created: 0, updated: 0, skipped: 0, noChange: 0 };
    const snaps = new Map(); // item id → applied snapshot
    const targets = []; // [item id, content id] of created contents

    // CREATE: pieces are inserted in batches (contents, links, activity), not one by one.
    const creates = items.filter((it) => outcomeOf(it) === "create").map((it) => ({ it, id: newId("cnt"), desired: R.desiredContent(it, ctx) }));
    await insertMany(t, "content_items",
      ["id", "client_id", "title", "platform", "content_type", "scheduled_at", "status", "internal_notes", "pillar", "cta"],
      creates.map(({ id, desired: x }) => [id, clientId, x.title, x.platform, x.content_type, x.scheduled_at, d.default_content_status, x.internal_notes, x.pillar, x.cta]));
    await insertMany(t, "activity_log",
      ["client_id", "content_id", "actor_type", "actor_name", "event", "data", "client_visible"],
      creates.map(({ id, desired: x }) => [clientId, id, ACTOR.actorType, ACTOR.actorName, "content.created", JSON.stringify({ title: x.title, via: "planning", draftId }), false]),
      { casts: ["", "", "", "", "", "::jsonb", ""] });
    await insertMany(t, "planning_content_links",
      ["client_id", "period_month", "external_code", "content_id", "draft_id", "item_id", "snapshot"],
      creates.filter(({ it }) => it.external_code).map(({ it, id, desired: x }) =>
        [clientId, d.period_month, it.external_code, id, draftId, it.id, JSON.stringify({ ...x, status: d.default_content_status, version: 1 })]),
      { casts: ["", "", "", "", "", "", "::jsonb"],
        suffix: ` ON CONFLICT (client_id, period_month, external_code) DO UPDATE
          SET content_id = EXCLUDED.content_id, draft_id = EXCLUDED.draft_id, item_id = EXCLUDED.item_id, snapshot = EXCLUDED.snapshot, ack = NULL, updated_at = now()` });
    for (const { it, id, desired } of creates) {
      snaps.set(it.id, { outcome: "create", contentId: id, version: 1, fields: desired });
      targets.push({ id: it.id, target: id });
      done.created++;
    }

    for (const it of items) {
      const outcome = outcomeOf(it);
      if (outcome === "create") continue;
      const desired = R.desiredContent(it, ctx);
      if (outcome === "update") {
        const v = await updateFromPlan(t, clientId, it.target, desired, draftId);
        snaps.set(it.id, { outcome, contentId: it.target, version: v.version, fields: desired, changed: v.changed });
        if (it.external_code) {
          await t.query(
            `UPDATE planning_content_links SET draft_id = $4, item_id = $5, snapshot = $6::jsonb, ack = NULL, updated_at = now()
              WHERE client_id = $1 AND period_month = $2 AND external_code = $3`,
            [clientId, d.period_month, it.external_code, draftId, it.id, JSON.stringify({ ...desired, status: v.status, version: v.version })]
          );
        }
        done.updated++;
      } else if (outcome === "skip") {
        if (it.computed === "conflict" && it.resolution === "studio" && it.external_code) {
          // remember the Excel values Studio chose not to take: the same Excel will not conflict again
          await t.query(`UPDATE planning_content_links SET ack = $4::jsonb, updated_at = now() WHERE client_id = $1 AND period_month = $2 AND external_code = $3`,
            [clientId, d.period_month, it.external_code, JSON.stringify(desired)]);
        }
        snaps.set(it.id, { outcome });
        done.skipped++;
      } else {
        snaps.set(it.id, { outcome });
        done.noChange++;
      }
    }
    // one UPDATE for every item's result
    const tmap = new Map(targets.map((x) => [x.id, x.target]));
    await t.query(
      `UPDATE planning_draft_items p SET applied_snapshot = x.snap, applied_at = now(), target_content_id = COALESCE(x.target, p.target_content_id)
         FROM jsonb_to_recordset($1::jsonb) AS x(id text, snap jsonb, target text) WHERE p.id = x.id`,
      [JSON.stringify(items.map((it) => ({ id: it.id, snap: snaps.get(it.id) || { outcome: outcomeOf(it) }, target: tmap.get(it.id) ?? null })))]
    );

    const final = { ...summary, ...done };
    await t.query(`UPDATE planning_drafts SET status = 'applied', applied_at = now(), summary = $2::jsonb WHERE id = $1`, [draftId, JSON.stringify(final)]);
    await logActivity(t, { clientId, ...ACTOR, event: "planning.import_applied",
      data: { draftId, month: d.period_month, source: d.source_type, created: done.created, updated: done.updated, skipped: done.skipped } });
    return done;
  });
}

// Updates an existing content from the plan, mirroring updateContent's rules
// (version bump on client-facing fields; approved/scheduled go back to review).
async function updateFromPlan(t, clientId, contentId, desired, draftId) {
  const [cur] = await t.query(`SELECT * FROM content_items WHERE id = $1 AND client_id = $2 FOR UPDATE`, [contentId, clientId]);
  if (!cur) throw new InputError("El contenido ya no existe.", 409);
  const now = trackedOfContent(cur);
  const changed = R.TRACKED_FIELDS.filter((f) => !eq(now[f], desired[f]));
  if (!changed.length) return { version: cur.version, status: cur.status, changed };
  const bump = changed.some((c) => CLIENT_FACING.includes(c));
  const invalidate = bump && ["approved", "scheduled"].includes(cur.status);
  const sets = changed.map((c, i) => `${c} = $${i + 3}`);
  await t.query(
    `UPDATE content_items SET ${sets.join(", ")}${bump ? ", version = version + 1" : ""}${invalidate ? ", status = 'review'" : ""}, updated_at = now() WHERE id = $1 AND client_id = $2`,
    [contentId, clientId, ...changed.map((c) => desired[c])]
  );
  const base = { clientId, contentId, ...ACTOR };
  const fields = changed.filter((c) => c !== "scheduled_at");
  if (fields.length) await logActivity(t, { ...base, event: "content.updated", data: { fields, via: "planning", draftId } });
  if (changed.includes("scheduled_at")) await logActivity(t, { ...base, event: "content.rescheduled", data: { from: iso(cur.scheduled_at), to: desired.scheduled_at, via: "planning" } });
  if (invalidate) await logActivity(t, { ...base, event: "content.approval_invalidated", data: { fromVersion: cur.version, toVersion: cur.version + 1, fromStatus: cur.status, fields: changed.filter((c) => CLIENT_FACING.includes(c)) } });
  return { version: bump ? cur.version + 1 : cur.version, status: invalidate ? "review" : cur.status, changed };
}

// ---- read models for future AI / MCP sources -------------------------------------

// What exists in Studio for a month, with the plan item each content came from (if any).
export async function getPlanningMonth(db, clientId, month) {
  if (!MONTH.test(String(month))) throw new InputError("Mes inválido.");
  const mr = monthRange(month);
  const rows = await db.query(
    `SELECT i.id, i.title, i.status, i.content_type, i.platform, i.scheduled_at, l.external_code
       FROM content_items i LEFT JOIN planning_content_links l ON l.content_id = i.id AND l.client_id = i.client_id
      WHERE i.client_id = $1 AND i.scheduled_at >= $2 AND i.scheduled_at < $3 ORDER BY i.scheduled_at`, [clientId, mr.start, mr.end]);
  return { month, contents: rows.map((r) => ({ id: r.id, title: r.title, status: r.status, contentType: r.content_type, platform: r.platform, scheduledAt: iso(r.scheduled_at), externalCode: r.external_code })) };
}

// Context an AI/MCP planner will read before drafting: goal, rules from earlier plans, the month so far.
export async function getClientPlanningContext(db, clientId, month) {
  const [c] = await db.query(
    `SELECT c.id, c.name, COALESCE(NULLIF(g.contracted, 0), NULLIF((c.settings->>'defaultMonthly')::int, 0)) AS goal
       FROM clients c LEFT JOIN client_month_goals g ON g.client_id = c.id AND g.month = $2 WHERE c.id = $1`, [clientId, month]);
  if (!c) throw new InputError("Cliente no encontrado.", 404);
  const notes = await db.query(`SELECT period_month, notes FROM planning_drafts WHERE client_id = $1 AND status = 'applied' ORDER BY applied_at DESC LIMIT 3`, [clientId]);
  return { client: { id: c.id, name: c.name }, month, goal: c.goal === null ? null : Number(c.goal), notes: notes.flatMap((n) => (n.notes || []).map((x) => ({ ...x, fromMonth: n.period_month }))), month_plan: await getPlanningMonth(db, clientId, month) };
}
