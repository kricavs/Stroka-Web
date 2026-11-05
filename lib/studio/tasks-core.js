// Studio-side tasks, db-injected (pg, PGlite, tests).
// Tasks without a client have no activity_log row (activity_log.client_id is
// required); everything tied to a client is logged.
import { logActivity, newId } from "../portal/activity-core.js";
import { OPEN_TASK_STATUSES, TASK_PRIORITIES, TASK_STATUSES, TASK_VISIBILITIES, cleanText } from "../shared/content.js";
import { parseYmd } from "../shared/time.js";
import { InputError } from "./errors.js";

const ACTOR = { actorType: "admin", actorName: "Stroka" };
const has = (list, v) => list.some(([k]) => k === v);

export function parseTaskInput(b, { partial = false } = {}) {
  const out = {};
  const present = (k) => b[k] !== undefined;
  if (present("title") || !partial) {
    const t = cleanText(b.title, 200);
    if (!t) throw new InputError("Ingresá un título (máximo 200 caracteres).");
    out.title = t;
  }
  if (present("description")) {
    const raw = String(b.description ?? "").trim();
    out.description = raw ? cleanText(raw, 4000) : null;
    if (raw && !out.description) throw new InputError("La descripción es demasiado larga.");
  }
  if (present("assignee")) out.assignee = String(b.assignee ?? "").trim().slice(0, 80) || null;
  if (present("dueDate")) {
    const d = String(b.dueDate ?? "").trim();
    if (d && !parseYmd(d)) throw new InputError("Fecha límite inválida.");
    out.due_date = d || null;
  }
  if (present("priority") || !partial) {
    out.priority = String(b.priority ?? "normal");
    if (!has(TASK_PRIORITIES, out.priority)) throw new InputError("Prioridad inválida.");
  }
  if (present("visibility") || !partial) {
    out.visibility = String(b.visibility ?? "internal");
    if (!has(TASK_VISIBILITIES, out.visibility)) throw new InputError("Visibilidad inválida.");
  }
  if (present("clientId")) out.client_id = String(b.clientId || "") || null;
  if (present("contentId")) out.content_id = String(b.contentId || "") || null;
  return out;
}

// Resolves/validates the client ↔ content pair (content must belong to the client).
async function resolveLinks(t, v, current = {}) {
  let clientId = "client_id" in v ? v.client_id : current.client_id ?? null;
  const contentId = "content_id" in v ? v.content_id : current.content_id ?? null;
  if (contentId) {
    const [c] = await t.query(`SELECT client_id FROM content_items WHERE id = $1`, [contentId]);
    if (!c) throw new InputError("Contenido no encontrado.", 404);
    if (clientId && clientId !== c.client_id) throw new InputError("Ese contenido no pertenece al cliente elegido.");
    clientId = c.client_id;
  }
  if (clientId) {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
  }
  const visibility = v.visibility ?? current.visibility ?? "internal";
  if (visibility === "client" && !clientId) throw new InputError("Una tarea visible para el cliente necesita un cliente.");
  return { clientId, contentId };
}

export async function createTask(db, input) {
  const v = parseTaskInput(input);
  const id = newId("tsk");
  await db.tx(async (t) => {
    const { clientId, contentId } = await resolveLinks(t, v);
    await t.query(
      `INSERT INTO tasks (id, client_id, content_id, title, description, assignee, due_date, priority, visibility, kind, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual','Stroka')`,
      [id, clientId, contentId, v.title, v.description ?? null, v.assignee ?? null, v.due_date ?? null, v.priority, v.visibility]
    );
    if (clientId) await logActivity(t, { clientId, contentId, ...ACTOR, event: "task.created", data: { taskId: id, title: v.title }, clientVisible: v.visibility === "client" });
  });
  return id;
}

export async function updateTask(db, id, input) {
  const v = parseTaskInput(input, { partial: true });
  if (!Object.keys(v).length) throw new InputError("Nada para actualizar.");
  await db.tx(async (t) => {
    const [cur] = await t.query(`SELECT * FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur) throw new InputError("Tarea no encontrada.", 404);
    const { clientId, contentId } = await resolveLinks(t, v, cur);
    const next = { ...v, client_id: clientId, content_id: contentId };
    const cols = Object.keys(next);
    await t.query(`UPDATE tasks SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`, [id, ...cols.map((c) => next[c])]);
    if (clientId) await logActivity(t, { clientId, contentId, ...ACTOR, event: "task.updated", data: { taskId: id, fields: Object.keys(v) } });
  });
}

export async function setTaskStatus(db, id, status) {
  if (!has(TASK_STATUSES, status)) throw new InputError("Estado inválido.");
  return db.tx(async (t) => {
    const [cur] = await t.query(`SELECT client_id, content_id, status, title FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur) throw new InputError("Tarea no encontrada.", 404);
    if (cur.status === status) return { status };
    await t.query(
      `UPDATE tasks SET status = $2,
         completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE NULL END,
         completed_by = CASE WHEN $2 = 'completed' THEN 'Stroka' ELSE NULL END,
         completed_session_id = NULL, updated_at = now()
       WHERE id = $1`,
      [id, status]
    );
    const event = status === "completed" ? "task.completed" : status === "cancelled" ? "task.cancelled" : "task.updated";
    if (cur.client_id) {
      await logActivity(t, { clientId: cur.client_id, contentId: cur.content_id, ...ACTOR, event, data: { taskId: id, title: cur.title, from: cur.status, to: status } });
    }
    return { status };
  });
}

export async function getTask(db, id) {
  const [r] = await db.query(
    `SELECT t.*, to_char(t.due_date,'YYYY-MM-DD') AS due, c.name AS client_name, i.title AS content_title
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN content_items i ON i.id = t.content_id
      WHERE t.id = $1`,
    [id]
  );
  return r || null;
}

// filters: clientId, status ('open' | status), priority, visibility, overdue, today (+ `today` = 'YYYY-MM-DD')
export async function listTasks(db, { clientId, status, priority, visibility, overdue, dueToday, today, limit = 300 }) {
  const where = [];
  const p = [];
  const add = (sql, val) => { p.push(val); where.push(sql.replace("?", `$${p.length}`)); };
  if (clientId) add("t.client_id = ?", clientId);
  if (status === "open") add("t.status = ANY(?::text[])", OPEN_TASK_STATUSES);
  else if (status) add("t.status = ?", status);
  if (priority) add("t.priority = ?", priority);
  if (visibility) add("t.visibility = ?", visibility);
  if (overdue) { add("t.due_date < ?::date", today); where.push("t.status = ANY(ARRAY['pending','in_progress'])"); }
  if (dueToday) { add("t.due_date = ?::date", today); where.push("t.status = ANY(ARRAY['pending','in_progress'])"); }
  p.push(limit);
  return db.query(
    `SELECT t.id, t.client_id, t.content_id, t.title, t.assignee, t.priority, t.status, t.visibility, t.kind,
            to_char(t.due_date,'YYYY-MM-DD') AS due, t.completed_at, t.completed_by,
            c.name AS client_name, i.title AS content_title
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN content_items i ON i.id = t.content_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY (t.status = ANY(ARRAY['pending','in_progress'])) DESC, t.due_date NULLS LAST,
               CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at DESC
      LIMIT $${p.length}`,
    p
  );
}

export async function taskCounts(db, today) {
  const [r] = await db.query(
    `SELECT count(*) FILTER (WHERE due_date < $1::date)::int AS overdue,
            count(*) FILTER (WHERE due_date = $1::date)::int AS due_today
       FROM tasks WHERE status = ANY(ARRAY['pending','in_progress'])`,
    [today]
  );
  return r;
}
