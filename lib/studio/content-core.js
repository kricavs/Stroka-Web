// Studio-side content management, db-injected (pg, PGlite, tests).
import { logActivity, newId } from "../portal/activity-core.js";
import { CONTENT_TYPES, PLATFORMS, STATUSES, canStudioTransition, cleanPersonName, cleanText, isHttpUrl } from "../shared/content.js";
import { fromLocalInput } from "../shared/time.js";
import { InputError } from "./errors.js";

const ACTOR = { actorType: "admin", actorName: "Stroka" };
// Edits to these re-open anything already approved (Fase 2 compares `version`).
const CLIENT_FACING = ["title", "platform", "content_type", "scheduled_at", "copy", "client_notes", "preview_url"];

const camel = (r) => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.client_name,
  title: r.title,
  platform: r.platform,
  contentType: r.content_type,
  scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
  status: r.status,
  copy: r.copy ?? "",
  internalNotes: r.internal_notes ?? "",
  clientNotes: r.client_notes ?? "",
  assignee: r.assignee ?? "",
  version: r.version,
  sentToClientAt: r.sent_to_client_at,
  publishedAt: r.published_at,
  publishedUrl: r.published_url ?? "",
  previewUrl: r.preview_url ?? "",
});

// body.scheduledLocal: "YYYY-MM-DDTHH:mm" in the business zone, or "" for none.
export function parseContentInput(b, { partial = false } = {}) {
  const out = {};
  const has = (k) => b[k] !== undefined;
  const text = (k, max) => String(b[k] ?? "").trim().slice(0, max);
  if (has("title") || !partial) {
    out.title = text("title", 200);
    if (!out.title) throw new InputError("Ingresá un título.");
  }
  if (has("platform") || !partial) {
    out.platform = String(b.platform ?? "");
    if (!PLATFORMS.some(([k]) => k === out.platform)) throw new InputError("Plataforma inválida.");
  }
  if (has("contentType") || !partial) {
    out.content_type = String(b.contentType ?? "");
    if (!CONTENT_TYPES.some(([k]) => k === out.content_type)) throw new InputError("Tipo inválido.");
  }
  if (has("scheduledLocal")) {
    const raw = String(b.scheduledLocal ?? "").trim();
    if (!raw) out.scheduled_at = null;
    else {
      const d = fromLocalInput(raw);
      if (!d) throw new InputError("Fecha u hora inválida.");
      out.scheduled_at = d;
    }
  } else if (!partial) out.scheduled_at = null;
  for (const [k, col, max] of [
    ["copy", "copy", 8000],
    ["internalNotes", "internal_notes", 4000],
    ["clientNotes", "client_notes", 2000],
    ["assignee", "assignee", 80],
  ]) if (has(k)) out[col] = text(k, max) || null;
  for (const [k, col] of [["previewUrl", "preview_url"], ["publishedUrl", "published_url"]]) {
    if (!has(k)) continue;
    const v = text(k, 500);
    if (v && !isHttpUrl(v)) throw new InputError("Los enlaces deben empezar con http:// o https://");
    out[col] = v || null;
  }
  if (b.status !== undefined && !partial) {
    if (!["idea", "production"].includes(b.status)) throw new InputError("Estado inicial inválido.");
    out.status = b.status;
  }
  return out;
}

export async function createContent(db, clientId, input) {
  const v = parseContentInput(input);
  const id = newId("cnt");
  await db.tx(async (t) => {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    await t.query(
      `INSERT INTO content_items (id, client_id, title, platform, content_type, scheduled_at, status,
                                  copy, internal_notes, client_notes, assignee, preview_url, published_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, clientId, v.title, v.platform, v.content_type, v.scheduled_at, v.status || "idea",
       v.copy ?? null, v.internal_notes ?? null, v.client_notes ?? null, v.assignee ?? null,
       v.preview_url ?? null, v.published_url ?? null]
    );
    await logActivity(t, { clientId, contentId: id, ...ACTOR, event: "content.created", data: { title: v.title } });
  });
  return id;
}

export async function updateContent(db, id, input) {
  const v = parseContentInput(input, { partial: true });
  const cols = Object.keys(v);
  if (!cols.length) throw new InputError("Nada para actualizar.");
  return db.tx(async (t) => {
    const [cur] = await t.query(`SELECT * FROM content_items WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur) throw new InputError("Contenido no encontrado.", 404);
    const norm = (x) => (x instanceof Date ? x.getTime() : x ?? null);
    const same = (a, b) => norm(a) === norm(b);
    const changed = cols.filter((c) => !same(cur[c], v[c]));
    if (!changed.length) return { changed: [] };
    const bump = changed.some((c) => CLIENT_FACING.includes(c));
    // Approved / scheduled content changed in something the client saw: the
    // approval no longer applies. Back to internal review with a higher version;
    // the old approval stays in content_approvals as history of the old version.
    const invalidate = bump && ["approved", "scheduled"].includes(cur.status);
    const sets = changed.map((c, i) => `${c} = $${i + 2}`);
    await t.query(
      `UPDATE content_items SET ${sets.join(", ")}${bump ? ", version = version + 1" : ""}${invalidate ? ", status = 'review'" : ""}, updated_at = now() WHERE id = $1`,
      [id, ...changed.map((c) => v[c])]
    );
    const base = { clientId: cur.client_id, contentId: id, ...ACTOR };
    const fields = changed.filter((c) => c !== "scheduled_at");
    if (fields.length) await logActivity(t, { ...base, event: "content.updated", data: { fields } });
    if (changed.includes("scheduled_at")) {
      const iso = (d) => (d ? new Date(d).toISOString() : null);
      await logActivity(t, { ...base, event: "content.rescheduled", data: { from: iso(cur.scheduled_at), to: iso(v.scheduled_at) } });
    }
    if (invalidate) {
      await logActivity(t, {
        ...base, event: "content.approval_invalidated",
        data: { fromVersion: cur.version, toVersion: cur.version + 1, fromStatus: cur.status, fields: changed.filter((c) => CLIENT_FACING.includes(c)) },
      });
    }
    return { changed };
  });
}

export async function changeStatus(db, id, to) {
  if (!STATUSES.includes(to)) throw new InputError("Estado inválido.");
  return db.tx(async (t) => {
    const [cur] = await t.query(`SELECT client_id, status, version, published_at FROM content_items WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur) throw new InputError("Contenido no encontrado.", 404);
    if (!canStudioTransition(cur.status, to)) {
      throw new InputError(
        cur.status === "client_review" && ["approved", "changes_requested"].includes(to)
          ? "La aprobación la registra el cliente desde el portal, o Studio con “Registrar aprobación externa”."
          : `No se puede pasar de "${cur.status}" a "${to}".`,
        409
      );
    }
    // A new review round starts when work resumes after requested changes.
    const newRound = cur.status === "changes_requested" && to === "production";
    await t.query(
      `UPDATE content_items SET status = $2, version = version + ${newRound ? 1 : 0},
         sent_to_client_at = CASE WHEN $2 = 'client_review' THEN now() ELSE sent_to_client_at END,
         published_at = CASE WHEN $2 = 'published' AND published_at IS NULL THEN now() ELSE published_at END,
         updated_at = now()
       WHERE id = $1`,
      [id, to]
    );
    const base = { clientId: cur.client_id, contentId: id, ...ACTOR };
    await logActivity(t, { ...base, event: "content.status_changed", data: { from: cur.status, to, ...(newRound ? { newVersion: cur.version + 1 } : {}) } });
    if (to === "client_review") await logActivity(t, { ...base, event: "content.sent_for_review", data: { version: cur.version }, clientVisible: true });
    if (to === "published") await logActivity(t, { ...base, event: "content.published", clientVisible: true });
    return { from: cur.status, to };
  });
}

export async function getContent(db, id) {
  const [r] = await db.query(
    `SELECT i.*, c.name AS client_name FROM content_items i JOIN clients c ON c.id = i.client_id WHERE i.id = $1`,
    [id]
  );
  return r ? camel(r) : null;
}

// Filters: clientId, platform, status, type; range {start,end} (half-open UTC).
export async function listContent(db, { clientId, platform, status, type, range, undated = false, limit = 500 }) {
  const where = [];
  const p = [];
  const add = (sql, val) => { p.push(val); where.push(sql.replace("?", `$${p.length}`)); };
  if (clientId) add("i.client_id = ?", clientId);
  if (platform) add("i.platform = ?", platform);
  if (status) add("i.status = ?", status);
  if (type) add("i.content_type = ?", type);
  if (undated) where.push("i.scheduled_at IS NULL");
  else if (range) { add("i.scheduled_at >= ?", range.start); add("i.scheduled_at < ?", range.end); }
  p.push(limit);
  const rows = await db.query(
    `SELECT i.*, c.name AS client_name FROM content_items i JOIN clients c ON c.id = i.client_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY i.scheduled_at NULLS LAST, i.created_at DESC LIMIT $${p.length}`,
    p
  );
  return rows.map(camel);
}

// Counts for a client's month (all statuses; Studio view).
export async function clientMonthStats(db, clientId, { start, end }) {
  const rows = await db.query(
    `SELECT status, count(*)::int AS n FROM content_items
      WHERE client_id = $1 AND scheduled_at >= $2 AND scheduled_at < $3 GROUP BY status`,
    [clientId, start, end]
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export async function dashboardData(db, { today, upcoming, reviewLimit = 20 }) {
  const live = `i.status NOT IN ('idea','cancelled')`;
  const [todayItems, upcomingItems, review, changes] = await Promise.all([
    listContentRaw(db, `${live} AND i.scheduled_at >= $1 AND i.scheduled_at < $2`, [today.start, today.end]),
    listContentRaw(db, `${live} AND i.status <> 'published' AND i.scheduled_at >= $1 AND i.scheduled_at < $2`, [upcoming.start, upcoming.end]),
    listContentRaw(db, `i.status = 'client_review'`, [], reviewLimit),
    listContentRaw(db, `i.status = 'changes_requested'`, [], reviewLimit),
  ]);
  return { todayItems, upcomingItems, review, changes };
}

async function listContentRaw(db, whereSql, params, limit = 100) {
  const rows = await db.query(
    `SELECT i.*, c.name AS client_name FROM content_items i JOIN clients c ON c.id = i.client_id
      WHERE ${whereSql} ORDER BY i.scheduled_at NULLS LAST LIMIT ${Number(limit)}`,
    params
  );
  return rows.map(camel);
}

// ---- Fase 2: comments, external approval, history -------------------------

export async function addStudioComment(db, contentId, body) {
  const text = cleanText(body, 2000);
  if (!text) throw new InputError("Escribí un comentario (máximo 2000 caracteres).");
  return db.tx(async (t) => {
    const [c] = await t.query(`SELECT client_id FROM content_items WHERE id = $1`, [contentId]);
    if (!c) throw new InputError("Contenido no encontrado.", 404);
    const id = newId("cmt");
    await t.query(
      `INSERT INTO content_comments (id, content_id, client_id, author_type, author_name, body) VALUES ($1,$2,$3,'studio','Stroka',$4)`,
      [id, contentId, c.client_id, text]
    );
    await logActivity(t, { clientId: c.client_id, contentId, ...ACTOR, event: "content.comment_added", data: { commentId: id } });
    return { id };
  });
}

export async function listStudioComments(db, contentId) {
  const rows = await db.query(
    `SELECT id, author_type, author_name, body, created_at FROM content_comments WHERE content_id = $1 ORDER BY created_at, id LIMIT 300`,
    [contentId]
  );
  return rows.map((r) => ({ id: r.id, authorType: r.author_type, authorName: r.author_name, body: r.body, createdAt: new Date(r.created_at).toISOString() }));
}

export const EXTERNAL_CHANNELS = [["whatsapp", "WhatsApp"]];

// The client approved outside the portal (e.g. WhatsApp). Recorded as what it
// is: a Studio-registered external approval, never as a portal action.
export async function registerExternalApproval(db, contentId, { approverName, channel = "whatsapp", note }) {
  const who = cleanPersonName(approverName);
  if (!who) throw new InputError("Ingresá el nombre de quien aprobó.");
  if (!EXTERNAL_CHANNELS.some(([k]) => k === channel)) throw new InputError("Medio inválido.");
  const noteText = note ? cleanText(note, 500) : null;
  if (note && !noteText) throw new InputError("La nota es demasiado larga.");
  return db.tx(async (t) => {
    const [row] = await t.query(
      `UPDATE content_items SET status = 'approved', updated_at = now() WHERE id = $1 AND status = 'client_review'
       RETURNING client_id, version`,
      [contentId]
    );
    if (!row) {
      const [c] = await t.query(`SELECT 1 FROM content_items WHERE id = $1`, [contentId]);
      throw c ? new InputError("Solo se puede registrar una aprobación externa en “En revisión del cliente”.", 409) : new InputError("Contenido no encontrado.", 404);
    }
    await t.query(
      `INSERT INTO content_approvals (id, content_id, client_id, action, actor_name, actor_type, from_status, to_status, content_version, metadata)
       VALUES ($1,$2,$3,'manual_approval','Stroka','studio','client_review','approved',$4,$5::jsonb)`,
      [newId("apr"), contentId, row.client_id, row.version, JSON.stringify({ approverName: who, channel, note: noteText })]
    );
    await logActivity(t, {
      clientId: row.client_id, contentId, ...ACTOR, event: "content.manual_approval",
      data: { approverName: who, channel, version: row.version }, clientVisible: true,
    });
    return { approverName: who, version: row.version };
  });
}

export async function contentApprovals(db, contentId) {
  return db.query(
    `SELECT id, action, actor_name, actor_type, from_status, to_status, content_version, metadata, created_at
       FROM content_approvals WHERE content_id = $1 ORDER BY created_at, id`,
    [contentId]
  );
}

const HISTORY_EVENTS = [
  "content.created", "content.sent_for_review", "content.approved", "content.changes_requested",
  "content.manual_approval", "content.approval_invalidated", "content.status_changed", "content.published",
];
export async function contentHistory(db, contentId) {
  return db.query(
    `SELECT seq, event, actor_type, actor_name, data, created_at FROM activity_log
      WHERE content_id = $1 AND event = ANY($2::text[]) ORDER BY seq`,
    [contentId, HISTORY_EVENTS]
  );
}
