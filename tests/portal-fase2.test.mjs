import test from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as content from "../lib/studio/content-core.js";
import * as tasks from "../lib/studio/tasks-core.js";
import * as actions from "../lib/portal/actions-core.js";
import { attemptLogin, resolveSessionCore } from "../lib/portal/auth-core.js";
import { hashToken } from "../lib/portal/token.js";
import { contentRepo } from "../lib/portal/content-core.js";
import { mintScope, assertScope, scopedRunner } from "../lib/portal/scope-core.js";
import { sortPending, toPortalComment } from "../lib/portal/dto.js";

const PEPPER = "p".repeat(40);
process.env.PORTAL_SECRET = PEPPER;

const sq = (db) => (scope, sql, params = [], opts) => (assertScope(scope), scopedRunner(db.query, scope)(sql, params, opts));

// A client with a live session (no declared name yet) and helpers.
async function world(db, name = "Empresa Uno", ip = "ip1") {
  const id = await clients.createClient(db, { name, monthly: 4 });
  const { code } = await clients.generateAccess(db, id, { pepper: PEPPER });
  const login = await attemptLogin(db, { company: name, code, ipHash: ip, pepper: PEPPER });
  const s = await resolveSessionCore(db, hashToken(login.token));
  const scope = mintScope({ clientId: id, source: "session", sessionId: s.sessionId, displayName: s.displayName });
  const mk = async (title = "Reel", status = "client_review", extra = {}) => {
    const cid = await content.createContent(db, id, { title, platform: "instagram", contentType: "reel", scheduledLocal: "2026-12-10T10:00", copy: "copy", ...extra });
    await db.query(`UPDATE content_items SET status=$2 WHERE id=$1`, [cid, status]);
    return cid;
  };
  return { id, scope, mk, sessionId: s.sessionId, code, name };
}
const setup = async () => { const db = memoryDb(); await runMigrations(db, MIGRATIONS); return db; };
const rows = (db, sql, p) => db.query(sql, p);
const statusOf = async (db, id) => (await rows(db, `SELECT status, version FROM content_items WHERE id=$1`, [id]))[0];

test("migración 3: tablas, constraints y append-only", async () => {
  const db = await setup();
  const t = (await rows(db, `select table_name from information_schema.tables where table_schema='public'`)).map((r) => r.table_name);
  for (const n of ["content_comments", "content_approvals", "tasks"]) assert.ok(t.includes(n), n);
  assert.deepEqual((await rows(db, `select id from schema_migrations order by id`)).map((r) => r.id), MIGRATIONS.map((m) => m.id));
  assert.deepEqual((await runMigrations(db, MIGRATIONS)).applied, []);
  const w = await world(db);
  const cid = await w.mk();
  await actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "María Gómez" });
  await assert.rejects(rows(db, `UPDATE content_approvals SET actor_name='x'`), /append-only/);
  await assert.rejects(rows(db, `DELETE FROM content_approvals`), /append-only/);
  // reglas de tasks
  await assert.rejects(rows(db, `INSERT INTO tasks (id,title,visibility) VALUES ('t1','x','client')`));
  await assert.rejects(rows(db, `INSERT INTO tasks (id,title,content_id) VALUES ('t2','x','${cid}')`));
  const other = await clients.createClient(db, { name: "Otra" });
  await assert.rejects(rows(db, `INSERT INTO tasks (id,client_id,content_id,title) VALUES ('t3','${other}','${cid}','x')`), "FK compuesta");
});

test("aprobar: válido, registra todo en una transacción", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Reel A");
  const r = await actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "  María   Gómez " });
  assert.equal(r.approvedBy, "María Gómez");
  assert.equal((await statusOf(db, cid)).status, "approved");
  const [a] = await rows(db, `SELECT * FROM content_approvals`);
  assert.deepEqual([a.action, a.actor_type, a.from_status, a.to_status, a.content_version, a.session_id], ["approved", "client", "client_review", "approved", 1, w.sessionId]);
  assert.equal((await rows(db, `SELECT display_name FROM client_sessions WHERE id=$1`, [w.sessionId]))[0].display_name, "María Gómez");
  assert.equal((await rows(db, `SELECT 1 FROM activity_log WHERE event='content.approved' AND actor_name='María Gómez'`)).length, 1);
  const repo = contentRepo(sq(db));
  const ap = await repo.currentApproval(w.scope, cid, 1);
  assert.deepEqual([ap.by, ap.external], ["María Gómez", false]);
});

test("nombre: se pide la primera vez y no la segunda", async () => {
  const db = await setup();
  const w = await world(db);
  const a = await w.mk("A"), b = await w.mk("B");
  await assert.rejects(actions.approveContent(db, w.scope, { contentId: a, version: 1 }), (e) => e.status === 428);
  assert.equal((await statusOf(db, a)).status, "client_review", "sin nombre no cambia nada");
  await actions.approveContent(db, w.scope, { contentId: a, version: 1, name: "Luis" });
  await actions.approveContent(db, w.scope, { contentId: b, version: 1 }); // ya no lo pide
  assert.equal((await rows(db, `SELECT DISTINCT actor_name FROM content_approvals`)).map((r) => r.actor_name).join(), "Luis");
  assert.equal((await actions.setSessionName(db, w.scope, "Luisa M")).name, "Luisa M");
  await assert.rejects(actions.setSessionName(db, w.scope, "<"), /2 y 80/);
});

test("aprobar: estado inválido, versión vieja, cliente incorrecto, doble aprobación", async () => {
  const db = await setup();
  const w = await world(db);
  const other = await world(db, "Empresa Dos", "ip2");
  const prod = await w.mk("P", "production"), rev = await w.mk("R", "client_review");
  const foreign = await other.mk("F", "client_review");
  const run = (scope, contentId, version = 1) => actions.approveContent(db, scope, { contentId, version, name: "N N" });
  await assert.rejects(run(w.scope, prod), (e) => e.status === 404 || e.status === 409);
  await assert.rejects(run(w.scope, foreign), (e) => e.status === 404, "contenido ajeno = 404");
  await assert.rejects(run(w.scope, rev, 7), (e) => e.status === 409, "versión vieja");
  await assert.rejects(actions.approveContent(db, w.scope, { contentId: rev, version: "x", name: "N N" }), /Versión/);
  await run(w.scope, rev);
  await assert.rejects(run(w.scope, rev), (e) => e.status === 409, "segunda aprobación");
  assert.equal((await rows(db, `SELECT 1 FROM content_approvals`)).length, 1);
  assert.equal((await statusOf(db, foreign)).status, "client_review");
});

test("aprobar en paralelo: una sola gana, sin duplicados", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  const res = await Promise.allSettled([1, 2, 3].map(() => actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "Ana Ruiz" })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(res.filter((r) => r.status === "rejected").every((r) => r.reason.status === 409));
  assert.equal((await rows(db, `SELECT 1 FROM content_approvals`)).length, 1);
  assert.equal((await rows(db, `SELECT 1 FROM activity_log WHERE event='content.approved'`)).length, 1);
});

test("pedir cambios: comentario + aprobación + estado + tarea + actividad", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Spot");
  await assert.rejects(actions.requestChanges(db, w.scope, { contentId: cid, version: 1, body: "   ", name: "Ana Ruiz" }), /Contanos/);
  const r = await actions.requestChanges(db, w.scope, { contentId: cid, version: 1, body: "Cambiar la música", name: "Ana Ruiz" });
  assert.equal((await statusOf(db, cid)).status, "changes_requested");
  const [ap] = await rows(db, `SELECT * FROM content_approvals`);
  assert.deepEqual([ap.action, ap.to_status, ap.comment_id], ["changes_requested", "changes_requested", r.commentId]);
  const [tk] = await rows(db, `SELECT * FROM tasks`);
  assert.deepEqual([tk.title, tk.kind, tk.visibility, tk.priority, tk.status, tk.content_id], ["Cambios solicitados — Spot", "change_request", "internal", "high", "pending", cid]);
  const ev = (await rows(db, `SELECT event FROM activity_log WHERE content_id=$1 ORDER BY seq`, [cid])).map((e) => e.event);
  for (const e of ["content.changes_requested", "content.comment_added", "task.created"]) assert.ok(ev.includes(e), e);
  await assert.rejects(actions.requestChanges(db, w.scope, { contentId: cid, version: 1, body: "otra vez", name: "x y" }), (e) => e.status === 409);
  assert.equal((await rows(db, `SELECT 1 FROM tasks`)).length, 1, "sin tarea duplicada");
});

test("pedir cambios: si falla una parte se revierte todo (rollback)", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Spot");
  await db.query(`ALTER TABLE tasks ADD CONSTRAINT boom CHECK (title <> 'Cambios solicitados — Spot')`); // fuerza el fallo del último INSERT
  await assert.rejects(actions.requestChanges(db, w.scope, { contentId: cid, version: 1, body: "x", name: "Ana Ruiz" }));
  assert.equal((await statusOf(db, cid)).status, "client_review");
  for (const t of ["content_comments", "content_approvals", "tasks"]) assert.equal((await rows(db, `SELECT 1 FROM ${t}`)).length, 0, t);
  assert.equal((await rows(db, `SELECT 1 FROM activity_log WHERE event LIKE 'content.%'`)).filter(Boolean).length, (await rows(db, `SELECT 1 FROM activity_log WHERE event='content.created'`)).length);
  assert.equal((await rows(db, `SELECT display_name FROM client_sessions WHERE id=$1`, [w.sessionId]))[0].display_name, null, "ni el nombre quedó guardado");
});

test("flujo completo: cambios → nueva versión → aprobación", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Video");
  await actions.requestChanges(db, w.scope, { contentId: cid, version: 1, body: "Más corto", name: "Ana Ruiz" });
  await content.changeStatus(db, cid, "production");
  assert.equal((await statusOf(db, cid)).version, 2, "nueva ronda = versión superior");
  await content.changeStatus(db, cid, "review");
  await content.changeStatus(db, cid, "client_review");
  await assert.rejects(actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "x y" }), (e) => e.status === 409, "la versión 1 ya no se puede aprobar");
  await actions.approveContent(db, w.scope, { contentId: cid, version: 2 });
  const hist = await rows(db, `SELECT action, content_version FROM content_approvals ORDER BY created_at`);
  assert.deepEqual(hist.map((h) => [h.action, h.content_version]), [["changes_requested", 1], ["approved", 2]]);
  const ev = (await content.contentHistory(db, cid)).map((h) => h.event);
  assert.ok(ev.includes("content.sent_for_review") && ev.includes("content.changes_requested") && ev.includes("content.approved"));
});

test("aprobación externa (WhatsApp): solo en client_review, queda como externa", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Post");
  const idea = await w.mk("I", "idea");
  await assert.rejects(content.registerExternalApproval(db, idea, { approverName: "Ana Ruiz" }), (e) => e.status === 409);
  await assert.rejects(content.registerExternalApproval(db, cid, { approverName: "" }), /nombre/);
  await assert.rejects(content.registerExternalApproval(db, cid, { approverName: "Ana Ruiz", channel: "fax" }), /Medio/);
  await content.registerExternalApproval(db, cid, { approverName: "Ana Ruiz", channel: "whatsapp", note: "Lo confirmó por audio" });
  const [a] = await rows(db, `SELECT * FROM content_approvals`);
  assert.deepEqual([a.action, a.actor_type, a.actor_name, a.session_id, a.metadata.approverName, a.metadata.channel], ["manual_approval", "studio", "Stroka", null, "Ana Ruiz", "whatsapp"]);
  const ap = await contentRepo(sq(db)).currentApproval(w.scope, cid, 1);
  assert.deepEqual([ap.by, ap.external, ap.channel], ["Ana Ruiz", true, "whatsapp"]);
  assert.ok(!JSON.stringify(ap).includes("audio"), "la nota interna no llega al portal");
  await assert.rejects(content.registerExternalApproval(db, cid, { approverName: "Ana Ruiz" }), (e) => e.status === 409);
});

test("invalidación: cambios visibles sobre approved/scheduled vuelven a review; internos no", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk("Reel", "client_review");
  await actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "Ana Ruiz" });
  await content.updateContent(db, cid, { internalNotes: "x", assignee: "Juan" });
  assert.deepEqual(await statusOf(db, cid), { status: "approved", version: 1 }, "interno: no invalida");
  await content.updateContent(db, cid, { copy: "Nuevo copy" });
  assert.deepEqual(await statusOf(db, cid), { status: "review", version: 2 });
  const [e] = await rows(db, `SELECT data FROM activity_log WHERE event='content.approval_invalidated'`);
  assert.deepEqual([e.data.fromVersion, e.data.toVersion, e.data.fromStatus, e.data.fields], [1, 2, "approved", ["copy"]]);
  assert.equal((await rows(db, `SELECT 1 FROM content_approvals`)).length, 1, "la aprobación vieja se conserva");
  assert.equal(await contentRepo(sq(db)).currentApproval(w.scope, cid, 2), null);
  // scheduled + cambio de fecha
  await db.query(`UPDATE content_items SET status='scheduled' WHERE id=$1`, [cid]);
  await content.updateContent(db, cid, { scheduledLocal: "2026-12-20T10:00" });
  assert.deepEqual(await statusOf(db, cid), { status: "review", version: 3 });
  // en producción no hay nada que invalidar
  const p = await w.mk("P", "production");
  await content.updateContent(db, p, { copy: "otro" });
  assert.equal((await statusOf(db, p)).status, "production");
});

test("comentarios: hilo aislado por cliente, solo texto, autores", async () => {
  const db = await setup();
  const w = await world(db);
  const o = await world(db, "Empresa Dos", "ip2");
  const cid = await w.mk("A"), prod = await w.mk("Prod", "production"), foreign = await o.mk("F");
  await actions.addClientComment(db, w.scope, { contentId: cid, body: "<script>alert(1)</script> ¿Cambiamos la música?", name: "Ana Ruiz" });
  await content.addStudioComment(db, cid, "Sí, subimos una nueva versión.");
  await assert.rejects(actions.addClientComment(db, w.scope, { contentId: foreign, body: "hola" }), (e) => e.status === 404);
  await assert.rejects(actions.addClientComment(db, w.scope, { contentId: prod, body: "hola" }), (e) => e.status === 404, "producción: sin detalle, sin comentarios");
  await assert.rejects(actions.addClientComment(db, w.scope, { contentId: cid, body: "x".repeat(2001) }), /máximo/);
  await assert.rejects(actions.addClientComment(db, w.scope, { contentId: cid, body: "  " }), /Escribí/);
  const repo = contentRepo(sq(db));
  const list = await repo.listComments(w.scope, cid);
  assert.deepEqual(list.map((c) => [c.authorType, c.authorName]), [["client", "Ana Ruiz"], ["studio", "Stroka"]]);
  assert.ok(list[0].body.includes("<script>"), "se guarda como texto; React lo escapa al mostrarlo");
  assert.deepEqual(Object.keys(list[0]).sort(), ["authorName", "authorType", "body", "createdAt", "id"]);
  assert.deepEqual(await repo.listComments(w.scope, foreign), [], "comentarios de otro cliente");
  assert.deepEqual(await repo.listComments(o.scope, cid), []);
  // el contenido deja de ser visible ⇒ el hilo también
  await db.query(`UPDATE content_items SET status='review' WHERE id=$1`, [cid]);
  assert.deepEqual(await repo.listComments(w.scope, cid), []);
});

test("comentarios: límite por hora", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  for (let i = 0; i < actions.COMMENTS_PER_HOUR; i++) await actions.addClientComment(db, w.scope, { contentId: cid, body: `c${i}`, name: "Ana Ruiz" });
  await assert.rejects(actions.addClientComment(db, w.scope, { contentId: cid, body: "uno más" }), (e) => e.status === 429);
});

test("tareas de cliente: ver, completar una vez, ajena = 404, internas invisibles", async () => {
  const db = await setup();
  const w = await world(db);
  const o = await world(db, "Empresa Dos", "ip2");
  const mine = await tasks.createTask(db, { clientId: w.id, title: "Enviar fotos", visibility: "client", dueDate: "2026-11-10" });
  const internal = await tasks.createTask(db, { clientId: w.id, title: "Interna", visibility: "internal" });
  const theirs = await tasks.createTask(db, { clientId: o.id, title: "De otro", visibility: "client" });
  const repo = contentRepo(sq(db));
  const pend = await repo.listPending(w.scope, new Date("2026-11-12T15:00:00Z"));
  assert.deepEqual(pend.map((p) => p.task.title), ["Enviar fotos"]);
  assert.equal(pend[0].task.overdue, true);
  assert.deepEqual(Object.keys(pend[0].task).sort(), ["contentId", "contentTitle", "description", "dueDate", "id", "overdue", "status", "title"]);
  await assert.rejects(actions.completeClientTask(db, w.scope, { taskId: theirs, name: "Ana Ruiz" }), (e) => e.status === 404);
  await assert.rejects(actions.completeClientTask(db, w.scope, { taskId: internal, name: "Ana Ruiz" }), (e) => e.status === 404);
  await actions.completeClientTask(db, w.scope, { taskId: mine, name: "Ana Ruiz" });
  const [t] = await rows(db, `SELECT status, completed_by, completed_session_id, completed_at FROM tasks WHERE id=$1`, [mine]);
  assert.deepEqual([t.status, t.completed_by, t.completed_session_id], ["completed", "Ana Ruiz", w.sessionId]);
  assert.ok(t.completed_at);
  await assert.rejects(actions.completeClientTask(db, w.scope, { taskId: mine }), (e) => e.status === 409);
  const res = await Promise.allSettled([1, 2].map(() => actions.completeClientTask(db, w.scope, { taskId: theirs.replace("x", "x") === theirs ? mine : mine })));
  assert.ok(res.every((r) => r.status === "rejected"));
  assert.equal((await rows(db, `SELECT 1 FROM activity_log WHERE event='task.completed'`)).length, 1);
  assert.equal((await repo.pendingCounts(w.scope)).tasks, 0);
});

test("completar tarea en paralelo: una sola vez", async () => {
  const db = await setup();
  const w = await world(db);
  const tk = await tasks.createTask(db, { clientId: w.id, title: "Subir logo", visibility: "client" });
  const res = await Promise.allSettled([1, 2, 3].map(() => actions.completeClientTask(db, w.scope, { taskId: tk, name: "Ana Ruiz" })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await rows(db, `SELECT 1 FROM activity_log WHERE event='task.completed'`)).length, 1);
});

test("admin-preview y sesiones inválidas no pueden actuar", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  const preview = mintScope({ clientId: w.id, source: "admin-preview" });
  await assert.rejects(actions.approveContent(db, preview, { contentId: cid, version: 1, name: "Ana Ruiz" }), /Modo vista cliente/);
  await assert.rejects(actions.addClientComment(db, preview, { contentId: cid, body: "x" }), /Modo vista cliente/);
  await assert.rejects(actions.setSessionName(db, preview, "Ana Ruiz"), /Modo vista cliente/);
  await clients.revokeSessions(db, w.id);
  await assert.rejects(actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "Ana Ruiz" }), (e) => e.status === 401);
  assert.equal((await statusOf(db, cid)).status, "client_review");
});

test("cliente desactivado no puede actuar con una sesión previa", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  await clients.setActive(db, w.id, false);
  await assert.rejects(actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "Ana Ruiz" }), (e) => e.status === 401);
});

test("Pendientes: orden (vencidos, aprobaciones, fecha) y sin tareas internas", () => {
  const items = [
    { kind: "task", overdue: false, when: "2026-11-20" },
    { kind: "changes", overdue: false, when: "2026-11-05T10:00:00Z" },
    { kind: "approval", overdue: false, when: "2026-11-25T10:00:00Z" },
    { kind: "task", overdue: true, when: "2026-11-01" },
    { kind: "approval", overdue: false, when: "2026-11-08T10:00:00Z" },
  ];
  assert.deepEqual(sortPending(items).map((i) => `${i.kind}:${i.overdue ? "late" : "ok"}`), ["task:late", "approval:ok", "approval:ok", "task:ok", "changes:ok"]);
  assert.equal(sortPending(items)[1].when, "2026-11-08T10:00:00Z");
});

test("tareas de Studio: validaciones, estados y actividad", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  await assert.rejects(tasks.createTask(db, { title: "x", visibility: "client" }), /necesita un cliente/);
  await assert.rejects(tasks.createTask(db, { title: "" }), /título/);
  await assert.rejects(tasks.createTask(db, { title: "x", dueDate: "2026-02-31" }), /inválida/);
  const o = await clients.createClient(db, { name: "Otra" });
  await assert.rejects(tasks.createTask(db, { title: "x", clientId: o, contentId: cid }), /no pertenece/);
  const id = await tasks.createTask(db, { title: "Armar guion", contentId: cid, priority: "urgent", assignee: "Juan", dueDate: "2026-11-05" });
  assert.equal((await tasks.getTask(db, id)).client_id, w.id, "el cliente se deduce del contenido");
  await tasks.updateTask(db, id, { title: "Armar guion v2", visibility: "client" });
  await tasks.setTaskStatus(db, id, "completed");
  assert.ok((await tasks.getTask(db, id)).completed_at);
  await tasks.setTaskStatus(db, id, "pending");
  assert.equal((await tasks.getTask(db, id)).completed_at, null);
  await tasks.setTaskStatus(db, id, "cancelled");
  await assert.rejects(tasks.setTaskStatus(db, id, "zzz"), /inválido/);
  const ev = (await rows(db, `SELECT event FROM activity_log WHERE event LIKE 'task.%' ORDER BY seq`)).map((r) => r.event);
  assert.deepEqual(ev, ["task.created", "task.updated", "task.completed", "task.updated", "task.cancelled"]);
  const solo = await tasks.createTask(db, { title: "Sin cliente" });
  assert.ok(solo);
  assert.deepEqual((await tasks.listTasks(db, { status: "open", today: "2026-11-05" })).map((t) => t.title), ["Sin cliente"]);
  assert.equal((await tasks.listTasks(db, { overdue: true, today: "2026-11-06" })).length, 0);
  assert.deepEqual(await tasks.taskCounts(db, "2026-11-05"), { overdue: 0, due_today: 0 });
});

test("sesión nueva: el nombre arranca vacío; activity sin secretos", async () => {
  const db = await setup();
  const w = await world(db);
  const cid = await w.mk();
  await actions.approveContent(db, w.scope, { contentId: cid, version: 1, name: "Ana Ruiz" });
  await actions.addClientComment(db, w.scope, { contentId: cid, body: "ok" });
  const all = JSON.stringify(await rows(db, `SELECT * FROM activity_log`)) + JSON.stringify(await rows(db, `SELECT * FROM content_approvals`));
  assert.ok(!all.includes(w.code) && !all.includes(PEPPER));
  assert.ok(!/token|cookie/i.test(JSON.stringify(await rows(db, `SELECT data FROM activity_log`))));
  const s2 = await attemptLogin(db, { company: w.name, code: w.code, ipHash: "ipx", pepper: PEPPER });
  assert.equal((await resolveSessionCore(db, hashToken(s2.token))).displayName, null);
});

test("DTO de comentario no expone ids internos", () => {
  const dto = toPortalComment({ id: "c", author_type: "client", author_name: "A", body: "b", created_at: new Date(), client_id: "x", content_id: "y" });
  assert.deepEqual(Object.keys(dto).sort(), ["authorName", "authorType", "body", "createdAt", "id"]);
});

test("Pendientes: changes_requested no aparece; contenido con tarea abierta se muestra como tarea", async () => {
  const db = await setup();
  const w = await world(db);
  const repo = contentRepo(sq(db));
  const rev = await w.mk("Para revisar", "client_review");
  const chg = await w.mk("Con cambios", "client_review");
  const withTask = await w.mk("Con tarea", "client_review");
  await actions.requestChanges(db, w.scope, { contentId: chg, version: 1, body: "ajustar", name: "Ana Ruiz" });
  assert.equal((await statusOf(db, chg)).status, "changes_requested");
  await tasks.createTask(db, { contentId: withTask, title: "Mandar logo", visibility: "client" });
  const p = await repo.listPending(w.scope);
  assert.deepEqual(p.map((i) => i.content?.title ?? i.task.title).sort(), ["Mandar logo", "Para revisar"]);
  assert.ok(p.every((i) => i.kind === "approval" || i.kind === "task"));
  assert.deepEqual(await repo.pendingCounts(w.scope), { review: 1, tasks: 1 });
  // el detalle sigue accesible aunque no sea un pendiente
  assert.equal((await repo.getVisible(w.scope, chg)).status, "changes_requested");
  await tasks.setTaskStatus(db, (await rows(db, `SELECT id FROM tasks WHERE title='Mandar logo'`))[0].id, "completed");
  assert.deepEqual(await repo.pendingCounts(w.scope), { review: 2, tasks: 0 });
  assert.ok(rev);
});
