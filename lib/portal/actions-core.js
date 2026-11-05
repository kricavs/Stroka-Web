// Portal WRITE operations (Fase 2), db-injected (pg, PGlite, tests).
//
// Every operation:
//  - takes a ClientScope and calls assertWritable (admin-preview can't act);
//  - runs in ONE db.tx(): all its writes commit together or not at all;
//  - addresses rows only through `client_id = $1` (scopedRunner injects the
//    scope's client id), INSERTs are written as INSERT … SELECT … FROM
//    content_items WHERE client_id = $1 AND id = … so ownership and
//    visibility are checked by the same statement that writes;
//  - re-validates the session inside the transaction (revoked/expired/inactive
//    client ⇒ 401) and takes the person's declared name from it;
//  - uses status/version conditions in UPDATE … WHERE so the loser of a race
//    gets a 409 and nothing is duplicated.
//
// The person's name is DECLARED by whoever holds the company code, not
// verified. It is a label for the history, not an identity.
import { CLIENT_COMMENTABLE_STATUSES } from "../shared/content.js";
import { cleanPersonName, cleanText } from "../shared/content.js";
import { InputError } from "../studio/errors.js";
import { logActivity, newId } from "./activity-core.js";
import { assertWritable, scopedRunner } from "./scope-core.js";

export const COMMENT_MAX = 2000;
export const COMMENTS_PER_HOUR = 20;

// Runs `fn(q, ctx)` in a transaction with a scoped runner and the verified session.
async function inSession(db, scope, name, fn) {
  assertWritable(scope);
  if (!scope.sessionId) throw new InputError("Sesión inválida.", 401);
  return db.tx(async (t) => {
    const q = scopedRunner(t.query, scope);
    const [s] = await q(
      `SELECT s.id, s.display_name FROM client_sessions s JOIN clients c ON c.id = s.client_id
        WHERE s.client_id = $1 AND s.id = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND c.active = true
        FOR UPDATE OF s`,
      [scope.sessionId]
    );
    if (!s) throw new InputError("Tu sesión ya no es válida. Ingresá de nuevo.", 401);
    let who = s.display_name;
    if (!who) {
      who = cleanPersonName(name);
      if (!who) throw new InputError("Ingresá tu nombre para continuar.", 428);
      await q(`UPDATE client_sessions SET display_name = $2 WHERE client_id = $1 AND id = $3`, [who, s.id]);
    }
    return fn(q, { t, who, sessionId: s.id });
  });
}

const badVersion = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? null : new InputError("Versión inválida."));

async function whyNoRow(q, contentId, visibleStatuses) {
  const [c] = await q(`SELECT status FROM content_items WHERE client_id = $1 AND id = $2`, [contentId]);
  if (!c || !visibleStatuses.includes(c.status)) return new InputError("No encontrado.", 404);
  return new InputError("Este contenido cambió mientras lo revisabas. Actualizá la página.", 409);
}

export async function setSessionName(db, scope, name) {
  assertWritable(scope);
  const who = cleanPersonName(name);
  if (!who) throw new InputError("El nombre debe tener entre 2 y 80 caracteres.");
  const rows = await db.query(
    `UPDATE client_sessions SET display_name = $3
      WHERE client_id = $1 AND id = $2 AND revoked_at IS NULL AND expires_at > now() RETURNING id`,
    [scope.clientId, scope.sessionId, who]
  );
  if (!rows.length) throw new InputError("Sesión inválida.", 401);
  return { name: who };
}

export function approveContent(db, scope, { contentId, version, name }) {
  if (badVersion(version)) return Promise.reject(badVersion(version));
  return inSession(db, scope, name, async (q, { t, who, sessionId }) => {
    const [row] = await q(
      `UPDATE content_items SET status = 'approved', updated_at = now()
        WHERE client_id = $1 AND id = $2 AND status = 'client_review' AND version = $3
        RETURNING version, title`,
      [String(contentId), Number(version)]
    );
    if (!row) throw await whyNoRow(q, String(contentId), ["client_review", "approved", "changes_requested", "scheduled", "published"]);
    const [a] = await q(
      `INSERT INTO content_approvals (id, content_id, client_id, action, actor_name, actor_type, session_id,
                                      from_status, to_status, content_version)
       SELECT $2, id, client_id, 'approved', $3, 'client', $4, 'client_review', 'approved', $5
         FROM content_items WHERE client_id = $1 AND id = $6 RETURNING created_at`,
      [newId("apr"), who, sessionId, row.version, String(contentId)]
    );
    await logActivity(t, {
      clientId: scope.clientId, contentId: String(contentId), actorType: "client", actorName: who,
      event: "content.approved", data: { version: row.version }, clientVisible: true,
    });
    return { approvedBy: who, at: a.created_at, version: row.version };
  });
}

export function requestChanges(db, scope, { contentId, version, body, name }) {
  if (badVersion(version)) return Promise.reject(badVersion(version));
  const text = cleanText(body, COMMENT_MAX);
  if (!text) return Promise.reject(new InputError("Contanos qué cambiarías (máximo 2000 caracteres)."));
  return inSession(db, scope, name, async (q, { t, who, sessionId }) => {
    const [row] = await q(
      `UPDATE content_items SET status = 'changes_requested', updated_at = now()
        WHERE client_id = $1 AND id = $2 AND status = 'client_review' AND version = $3
        RETURNING version, title`,
      [String(contentId), Number(version)]
    );
    if (!row) throw await whyNoRow(q, String(contentId), ["client_review", "approved", "changes_requested", "scheduled", "published"]);
    const commentId = newId("cmt");
    await q(
      `INSERT INTO content_comments (id, content_id, client_id, author_type, author_name, body)
       SELECT $2, id, client_id, 'client', $3, $4 FROM content_items WHERE client_id = $1 AND id = $5`,
      [commentId, who, text, String(contentId)]
    );
    await q(
      `INSERT INTO content_approvals (id, content_id, client_id, action, actor_name, actor_type, session_id,
                                      from_status, to_status, content_version, comment_id)
       SELECT $2, id, client_id, 'changes_requested', $3, 'client', $4, 'client_review', 'changes_requested', $5, $6
         FROM content_items WHERE client_id = $1 AND id = $7`,
      [newId("apr"), who, sessionId, row.version, commentId, String(contentId)]
    );
    const taskId = newId("tsk");
    await q(
      `INSERT INTO tasks (id, client_id, content_id, title, description, priority, status, visibility, kind, created_by)
       SELECT $2, client_id, id, $3, $4, 'high', 'pending', 'internal', 'change_request', $5
         FROM content_items WHERE client_id = $1 AND id = $6`,
      [taskId, `Cambios solicitados — ${row.title}`, text, who, String(contentId)]
    );
    const base = { clientId: scope.clientId, contentId: String(contentId), actorType: "client", actorName: who };
    await logActivity(t, { ...base, event: "content.changes_requested", data: { version: row.version }, clientVisible: true });
    await logActivity(t, { ...base, event: "content.comment_added", data: { commentId } });
    await logActivity(t, { ...base, event: "task.created", data: { taskId, kind: "change_request" } });
    return { taskId, commentId };
  });
}

export function addClientComment(db, scope, { contentId, body, name }) {
  const text = cleanText(body, COMMENT_MAX);
  if (!text) return Promise.reject(new InputError("Escribí un comentario (máximo 2000 caracteres)."));
  return inSession(db, scope, name, async (q, { t, who }) => {
    const [{ n }] = await q(
      `SELECT count(*)::int AS n FROM content_comments
        WHERE client_id = $1 AND author_type = 'client' AND author_name = $2 AND created_at > now() - interval '1 hour'`,
      [who]
    );
    if (n >= COMMENTS_PER_HOUR) throw new InputError("Demasiados comentarios seguidos. Probá en un rato.", 429);
    const id = newId("cmt");
    const rows = await q(
      `INSERT INTO content_comments (id, content_id, client_id, author_type, author_name, body)
       SELECT $2, id, client_id, 'client', $3, $4 FROM content_items
        WHERE client_id = $1 AND id = $5 AND status = ANY($6::text[]) RETURNING created_at`,
      [id, who, text, String(contentId), CLIENT_COMMENTABLE_STATUSES]
    );
    if (!rows.length) throw new InputError("No encontrado.", 404);
    await logActivity(t, {
      clientId: scope.clientId, contentId: String(contentId), actorType: "client", actorName: who,
      event: "content.comment_added", data: { commentId: id },
    });
    return { id, createdAt: rows[0].created_at };
  });
}

export function completeClientTask(db, scope, { taskId, name }) {
  return inSession(db, scope, name, async (q, { t, who, sessionId }) => {
    const [row] = await q(
      `UPDATE tasks SET status = 'completed', completed_at = now(), completed_by = $2, completed_session_id = $3, updated_at = now()
        WHERE client_id = $1 AND id = $4 AND visibility = 'client' AND status IN ('pending','in_progress')
        RETURNING title, content_id`,
      [who, sessionId, String(taskId)]
    );
    if (!row) {
      const [x] = await q(`SELECT status FROM tasks WHERE client_id = $1 AND id = $2 AND visibility = 'client'`, [String(taskId)]);
      throw x ? new InputError("Esta tarea ya fue resuelta.", 409) : new InputError("No encontrada.", 404);
    }
    await logActivity(t, {
      clientId: scope.clientId, contentId: row.content_id, actorType: "client", actorName: who,
      event: "task.completed", data: { taskId: String(taskId), title: row.title }, clientVisible: true,
    });
    return { completedBy: who };
  });
}
