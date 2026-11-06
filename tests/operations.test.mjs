import test from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as contentCore from "../lib/studio/content-core.js";
import * as tasksCore from "../lib/studio/tasks-core.js";
import { mintScope } from "../lib/portal/scope-core.js";
import * as actions from "../lib/portal/actions-core.js";
import * as C from "../lib/operations/config.js";
import * as R from "../lib/operations/rules.js";
import { getOperations, calendarTasks } from "../lib/operations/queries-core.js";
import { humanizeActivity } from "../lib/operations/activity-text.js";

// Mon 16 Nov 2026, 12:00 in Buenos Aires (UTC-3). November has 30 days.
const NOW = new Date("2026-11-16T15:00:00Z");
const at = (iso) => new Date(iso);
const item = (o) => ({ id: "c1", clientId: "A", clientName: "A", title: "Reel", status: "production", scheduledAt: null, sentToClientAt: null, ...o });

// ---- monthly progress ------------------------------------------------------

test("progreso: objetivo default, override y sin objetivo", () => {
  const p = R.getClientMonthProgress({ goal: 12, counts: { published: 4, scheduled: 2, production: 2 }, now: NOW });
  assert.equal(p.goal, 12); assert.equal(p.planned, 8); assert.equal(p.pct, 67); assert.equal(p.published, 4);
  assert.equal(R.getClientMonthProgress({ goal: null, counts: { published: 3 }, now: NOW }).hasGoal, false);
  const none = R.getClientMonthProgress({ goal: 0, counts: { production: 1 }, now: NOW });
  assert.deepEqual([none.goal, none.pct, none.pace], [null, null, "none"], "0 = sin objetivo, no 0%");
  assert.equal(R.PACE_LABEL.none, "Sin objetivo configurado");
});

test("progreso: cancelled no cuenta, published cuenta, idea no es planificado", () => {
  const p = R.getClientMonthProgress({ goal: 10, counts: { cancelled: 5, published: 2, idea: 3, approved: 1, client_review: 1, changes_requested: 1, review: 1 }, now: NOW });
  assert.equal(p.planned, 6); // 2 + 1 + 1 + 1 + 1
  assert.deepEqual([p.published, p.scheduled, p.withClient, p.inProduction, p.ideas], [2, 1, 2, 1, 3]);
});

test("progreso: se calcula sobre el mes actual de Buenos Aires (medianoche)", () => {
  // 1 Dec 01:30 UTC = 30 Nov 22:30 in Buenos Aires → still November
  assert.equal(R.getClientMonthProgress({ goal: 5, counts: {}, now: at("2026-12-01T01:30:00Z") }).month, "2026-11");
  assert.equal(R.getClientMonthProgress({ goal: 5, counts: {}, now: at("2026-12-01T03:00:00Z") }).month, "2026-12");
});

// ---- pace ------------------------------------------------------------------

test("ritmo: inicio, mitad, final, adelantado, atrasado y tolerancia (meta 12)", () => {
  const pace = (planned, iso) => R.getClientMonthProgress({ goal: 12, counts: { production: planned }, now: at(iso) }).pace;
  assert.equal(pace(0, "2026-11-02T15:00:00Z"), "early", "primeros días: no se evalúa");
  // día 15 de 30 → esperado 6, tolerancia max(1, 1.8) = 1.8
  assert.equal(pace(6, "2026-11-15T15:00:00Z"), "ok");
  assert.equal(pace(5, "2026-11-15T15:00:00Z"), "ok", "déficit 1 ≤ tolerancia");
  assert.equal(pace(4, "2026-11-15T15:00:00Z"), "low", "déficit 2 > 1.8");
  assert.equal(pace(2, "2026-11-15T15:00:00Z"), "behind", "déficit 4 > 3.6");
  assert.equal(pace(9, "2026-11-15T15:00:00Z"), "ahead");
  assert.equal(pace(8, "2026-11-30T15:00:00Z"), "behind", "fin de mes: esperado 12");
  assert.equal(pace(12, "2026-11-30T15:00:00Z"), "done");
  const p = R.getClientMonthProgress({ goal: 12, counts: { production: 2 }, now: at("2026-11-15T15:00:00Z") });
  assert.equal(p.expected, 6);
});

test("ritmo: sin objetivo nunca alerta", () => {
  const snap = { clients: [{ id: "A", name: "A", goal: null, monthCounts: {} }], content: [], tasks: [] };
  assert.equal(R.buildOperations(snap, at("2026-11-28T15:00:00Z")).alerts.length, 0);
});

// ---- approvals -------------------------------------------------------------

test("aprobaciones estancadas: recién enviado, 3+ días y zona horaria", () => {
  const sent = (iso) => item({ id: iso, status: "client_review", sentToClientAt: iso });
  const w = R.getWaitingApprovals([sent("2026-11-16T14:00:00Z"), sent("2026-11-13T10:00:00Z"), sent("2026-11-12T10:00:00Z")], NOW);
  assert.deepEqual(w.map((x) => [x.daysWaiting, x.stale]), [[4, true], [3, true], [0, false]], "más antiguos primero");
  // enviado 15 Nov 23:30 BA (= 16 Nov 02:30 UTC): para BA son 1 día, no 0
  const night = R.getWaitingApprovals([sent("2026-11-16T02:30:00Z")], NOW)[0];
  assert.equal(night.daysWaiting, 1);
  assert.equal(R.getStaleApprovals([sent("2026-11-13T15:00:00Z")], NOW).length, 1);
  assert.equal(R.getStaleApprovals([sent("2026-11-14T15:00:00Z")], NOW).length, 0, "2 días: todavía no");
});

// ---- content risk ----------------------------------------------------------

test("riesgo de publicación: mañana sin aprobar, aprobado, publicado, cancelado", () => {
  const tomorrow = "2026-11-17T21:00:00Z"; // 18:00 BA
  assert.equal(R.getContentRisk(item({ status: "client_review", scheduledAt: tomorrow, sentToClientAt: "2026-11-16T10:00:00Z" }), NOW).code, "publication_at_risk");
  assert.equal(R.getContentRisk(item({ status: "client_review", scheduledAt: tomorrow, sentToClientAt: "2026-11-16T10:00:00Z" }), NOW).level, "critical");
  for (const status of ["approved", "scheduled"]) assert.equal(R.getContentRisk(item({ status, scheduledAt: tomorrow }), NOW), null);
  assert.equal(R.getContentRisk(item({ status: "published", scheduledAt: tomorrow }), NOW), null);
  assert.equal(R.getContentRisk(item({ status: "cancelled", scheduledAt: tomorrow }), NOW), null);
  assert.equal(R.getContentRisk(item({ status: "idea", scheduledAt: tomorrow }), NOW).level, "critical", "un idea fechado mañana no está aprobado");
});

test("riesgo: ventana de 48 h, 7 días y fecha vencida", () => {
  const r = (iso, status = "production") => R.getContentRisk(item({ status, scheduledAt: iso }), NOW);
  assert.equal(r("2026-11-18T14:00:00Z")?.level, "critical", "47 h");
  assert.equal(r("2026-11-18T16:00:00Z")?.level, "attention", "49 h: próximo sin aprobar");
  assert.equal(r("2026-11-30T15:00:00Z"), null, "lejano");
  assert.equal(r("2026-11-16T10:00:00Z")?.text.startsWith("Fecha vencida"), true);
  assert.equal(r("2026-11-16T10:00:00Z", "approved")?.code, "overdue_unpublished", "aprobado que pasó su hora");
});

test("riesgo: cambios solicitados con quién y cuándo", () => {
  const rs = R.getContentReasons(item({ status: "changes_requested", changeRequestedBy: "María", changeRequestedAt: "2026-11-14T12:00:00Z" }), NOW);
  assert.equal(rs[0].code, "changes_requested"); assert.match(rs[0].text, /pedidos por María.*hace 2 días/);
});

// ---- tasks -----------------------------------------------------------------

test("tareas: vencida, hoy, próxima; completadas y canceladas no aparecen", () => {
  const t = (o) => ({ id: o.due + o.status, title: "t", priority: "normal", status: "pending", kind: "manual", ...o });
  const list = [t({ due: "2026-11-10" }), t({ due: "2026-11-16" }), t({ due: "2026-11-18" }), t({ due: "2026-11-22" }), t({ due: "2026-11-30" }),
    t({ due: "2026-11-10", status: "completed" }), t({ due: "2026-11-16", status: "cancelled" }), t({ due: null })];
  const b = R.getTaskBuckets(list, NOW);
  assert.deepEqual([b.overdue.length, b.today.length, b.upcoming.length, b.undated.length], [1, 1, 2, 1]);
  assert.equal(R.getTaskRisk(t({ due: "2026-11-10", status: "completed" }), NOW), null);
  assert.equal(R.getTaskRisk(t({ due: "2026-11-10" }), NOW).level, "warning");
  assert.equal(R.getTaskRisk(t({ due: "2026-11-10", priority: "urgent" }), NOW).level, "critical");
  assert.equal(R.getTaskRisk(t({ due: "2026-11-16" }), NOW), null, "vence hoy: está en Hoy, no alerta");
  assert.equal(R.getTaskRisk(t({ due: "2026-11-17" }), NOW).level, "attention");
  assert.equal(R.getTaskRisk(t({ due: "2026-11-25" }), NOW), null);
});

test("tareas: 'hoy' respeta Buenos Aires alrededor de medianoche", () => {
  const task = { id: "t", title: "t", priority: "normal", status: "pending", due: "2026-11-16" };
  // 17 Nov 01:00 UTC = 16 Nov 22:00 BA → todavía "hoy"
  assert.equal(R.getTaskBuckets([task], at("2026-11-17T01:00:00Z")).today.length, 1);
  // 17 Nov 03:30 UTC = 17 Nov 00:30 BA → ya vencida
  const b = R.getTaskBuckets([task], at("2026-11-17T03:30:00Z"));
  assert.deepEqual([b.today.length, b.overdue.length], [0, 1]);
});

// ---- operational status ----------------------------------------------------

const op = (over = {}) => {
  const base = { clients: [{ id: "A", name: "A", goal: 12, monthCounts: { production: 6 } }], content: [], tasks: [] };
  return R.buildOperations({ ...base, ...over }, at("2026-11-15T15:00:00Z"));
};

test("estado operativo: al día, atención, atrasado, bloqueado", () => {
  assert.equal(op().clients[0].status, "ok");
  assert.equal(op({ content: [item({ status: "client_review", sentToClientAt: "2026-11-10T15:00:00Z" })] }).clients[0].status, "attention");
  assert.equal(op({ clients: [{ id: "A", name: "A", goal: 12, monthCounts: { production: 1 } }] }).clients[0].status, "late");
  assert.equal(op({ content: [item({ status: "production", scheduledAt: "2026-11-16T21:00:00Z" })] }).clients[0].status, "blocked");
  assert.equal(op({ tasks: [{ id: "t", clientId: "A", title: "x", priority: "urgent", status: "pending", due: "2026-11-10", kind: "manual" }] }).clients[0].status, "blocked");
  assert.equal(op({ content: [item({ status: "changes_requested" })] }).clients[0].status, "attention", "cambios solicitados solos: atención");
});

// ---- dashboard -------------------------------------------------------------

test("dashboard: orden por severidad y sin duplicar cambios solicitados + su tarea", () => {
  const content = [
    item({ id: "c1", status: "changes_requested", changeRequestedBy: "María", changeRequestedAt: "2026-11-13T12:00:00Z", scheduledAt: "2026-11-25T15:00:00Z" }),
    item({ id: "c2", title: "Riesgo", status: "client_review", sentToClientAt: "2026-11-15T10:00:00Z", scheduledAt: "2026-11-16T21:00:00Z" }),
  ];
  const tasks = [
    { id: "t1", clientId: "A", clientName: "A", contentId: "c1", title: "Corregir", priority: "high", status: "pending", due: "2026-11-14", kind: "change_request" },
    { id: "t2", clientId: "A", clientName: "A", contentId: null, title: "Vencida", priority: "normal", status: "pending", due: "2026-11-01", kind: "manual" },
  ];
  const o = op({ content, tasks });
  assert.deepEqual(o.alerts.map((a) => a.level), ["critical", "warning", "warning"]);
  assert.equal(o.alerts[0].entityId, "c2");
  assert.equal(o.alerts.filter((a) => a.entityId === "t1").length, 0, "la tarea de cambios va dentro de la alerta del contenido");
  const ch = o.alerts.find((a) => a.entityId === "c1");
  assert.match(ch.detail, /María/); assert.match(ch.detail, /tarea: vencida/); assert.equal(ch.linkedTaskId, "t1");
  assert.equal(o.hoy.tasks.some((t) => t.id === "t1"), false);
});

test("dashboard: 'Hoy' no repite lo que ya está en Requiere atención", () => {
  const o = op({
    content: [item({ id: "ok", status: "scheduled", scheduledAt: "2026-11-15T21:00:00Z" }), item({ id: "bad", status: "production", scheduledAt: "2026-11-15T20:00:00Z" })],
  });
  assert.equal(o.hoy.publications.length, 2);
  assert.deepEqual(o.hoy.rows.publications.map((i) => i.id), ["ok"]);
});

test("dashboard: sin fecha agrupa por cliente y no marca ideas", () => {
  const o = op({ content: [item({ id: "a", status: "production" }), item({ id: "b", status: "review" }), item({ id: "i", status: "idea" })] });
  const u = o.alerts.filter((a) => a.code === "undated");
  assert.equal(u.length, 1); assert.match(u[0].detail, /2 contenidos sin fecha/);
});

test("próximos 7 días: excluye cancelado/publicado y marca riesgo", () => {
  const up = R.getUpcomingItems([
    item({ id: "1", status: "scheduled", scheduledAt: "2026-11-17T15:00:00Z" }), item({ id: "2", status: "production", scheduledAt: "2026-11-20T15:00:00Z" }),
    item({ id: "3", status: "cancelled", scheduledAt: "2026-11-18T15:00:00Z" }), item({ id: "4", status: "published", scheduledAt: "2026-11-18T15:00:00Z" }),
    item({ id: "5", status: "approved", scheduledAt: "2026-11-16T20:00:00Z" }), item({ id: "6", status: "approved", scheduledAt: "2026-11-24T02:00:00Z" }),
    item({ id: "7", status: "approved", scheduledAt: "2026-11-24T04:00:00Z" }),
  ], NOW);
  assert.deepEqual(up.map((i) => i.id), ["1", "2", "6"], "hoy no entra; el día +7 (hasta 23:59 BA) sí; +8 no");
  assert.equal(up[1].risk.level, "attention");
});

test("actividad humanizada: sin eventos técnicos ni ruido", () => {
  const row = (o) => ({ seq: 1, client_id: "A", client_name: "Torquen", content_id: "c", content_title: "Reel lanzamiento", actor_type: "client", actor_name: "María", data: {}, created_at: "2026-11-16T14:00:00Z", ...o });
  const out = humanizeActivity([
    row({ seq: 9, event: "content.approved" }), row({ seq: 8, event: "login.success" }),
    row({ seq: 7, event: "content.changes_requested" }), row({ seq: 6, event: "content.comment_added", created_at: "2026-11-16T14:00:01Z" }),
    row({ seq: 5, event: "task.created", data: { kind: "change_request" } }), row({ seq: 3, event: "content.created", actor_type: "admin", actor_name: "Stroka" }), row({ seq: 4, event: "file.marked_final", actor_type: "admin", data: { name: "Entrega" } }),
  ], NOW);
  assert.deepEqual(out.map((o) => o.text), ["María aprobó “Reel lanzamiento”", "María pidió cambios en “Reel lanzamiento”", "“Entrega” quedó como entrega final"]);
  assert.ok(out.every((o) => !/\w+\.\w+/.test(o.text.replace(/[“”]/g, ""))), "ningún nombre de evento");
  assert.equal(out[0].when, "11:00");
});

// ---- against a real database -----------------------------------------------

async function world() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  let n = 0;
  const calls = [];
  const counting = { ...db, query: async (s, p) => (calls.push(s), db.query(s, p)), tx: db.tx };
  const mk = async (name, { monthly = 0, active = true } = {}) => {
    const id = await clients.createClient(db, { name, monthly });
    if (!active) await clients.setActive(db, id, false);
    return id;
  };
  const content = async (clientId, o) => {
    const id = await contentCore.createContent(db, clientId, { title: o.title || `C${++n}`, platform: "instagram", contentType: "reel", scheduledLocal: "" });
    if (o.status || o.scheduledAt !== undefined || o.sent) {
      await db.query(`UPDATE content_items SET status = COALESCE($2, status), scheduled_at = $3, sent_to_client_at = $4 WHERE id = $1`, [id, o.status || null, o.scheduledAt || null, o.sent || null]);
    }
    return id;
  };
  return { db, counting, calls, mk, content };
}

test("loader: 4 consultas sin importar la cantidad de clientes; inactivos excluidos", async () => {
  const w = await world();
  for (let i = 0; i < 12; i++) {
    const id = await w.mk(`Cliente ${i}`, { monthly: 8 });
    await w.content(id, { status: "production", scheduledAt: "2026-11-20T15:00:00Z" });
    await tasksCore.createTask(w.db, { title: "t", clientId: id, dueDate: "2026-11-10" });
  }
  const off = await w.mk("Inactivo", { monthly: 8, active: false });
  await w.content(off, { status: "client_review", scheduledAt: "2026-11-17T15:00:00Z", sent: "2026-11-01T10:00:00Z" });
  await tasksCore.createTask(w.db, { title: "x", clientId: off, dueDate: "2026-11-01", priority: "urgent" });

  w.calls.length = 0;
  const ops = await getOperations(w.counting, { now: NOW });
  assert.equal(w.calls.length, 4, `consultas: ${w.calls.length}`);
  assert.equal(ops.clients.length, 12);
  assert.ok(ops.clients.every((c) => c.name !== "Inactivo"));
  assert.ok(ops.alerts.every((a) => a.clientName !== "Inactivo"), "ni alertas de clientes inactivos");
});

test("loader: objetivo default vs override del mes, sin objetivo y cancelado", async () => {
  const w = await world();
  const a = await w.mk("Con default", { monthly: 10 });
  const b = await w.mk("Con override", { monthly: 10 });
  const c = await w.mk("Sin objetivo", { monthly: 0 });
  await clients.setMonthGoal(w.db, b, "2026-11", 4);
  await clients.setMonthGoal(w.db, b, "2026-12", 99);
  for (const id of [a, b, c]) {
    await w.content(id, { status: "published", scheduledAt: "2026-11-05T15:00:00Z" });
    await w.content(id, { status: "cancelled", scheduledAt: "2026-11-06T15:00:00Z" });
  }
  const ops = await getOperations(w.db, { now: NOW });
  const by = Object.fromEntries(ops.clients.map((x) => [x.name, x.progress]));
  assert.deepEqual([by["Con default"].goal, by["Con default"].planned], [10, 1]);
  assert.equal(by["Con override"].goal, 4);
  assert.equal(by["Sin objetivo"].goal, null);
  assert.equal(by["Sin objetivo"].pace, "none");
});

test("loader: cambios solicitados reales traen quién y cuándo; tarea automática va dentro", async () => {
  const w = await world();
  const id = await w.mk("Torquen", { monthly: 4 });
  const cid = await w.content(id, { status: "client_review", scheduledAt: "2026-11-30T15:00:00Z", sent: "2026-11-15T10:00:00Z" });
  const [{ version }] = await w.db.query(`select version from content_items where id=$1`, [cid]);
  await w.db.query(`INSERT INTO client_sessions (id, client_id, token_hash, display_name, expires_at) VALUES ('s1',$1,'h','María', now() + interval '1 day')`, [id]);
  const scope = mintScope({ clientId: id, source: "session", sessionId: "s1", displayName: "María" });
  await actions.requestChanges(w.db, scope, { contentId: cid, version, body: "Cambiar el color", name: "María" });
  const ops = await getOperations(w.db, { now: new Date() });
  const alert = ops.alerts.find((x) => x.entityId === cid);
  assert.ok(alert, "alerta de cambios solicitados");
  assert.match(alert.detail, /María/);
  assert.ok(alert.linkedTaskId, "incluye la tarea automática");
  assert.equal(ops.alerts.filter((x) => x.kind === "task").length, 0, "la tarea no genera una fila aparte");
  const [{ title }] = await w.db.query(`select title from content_items where id=$1`, [cid]);
  assert.ok(ops.activity.some((x) => x.text === `María pidió cambios en “${title}”`));
  assert.equal(ops.activity.filter((x) => /comentó/.test(x.text)).length, 0, "el comentario del pedido no duplica la línea");
});

test("calendario: tareas con vencimiento en rango y sin vencimiento, filtrables", async () => {
  const w = await world();
  const a = await w.mk("A"), b = await w.mk("B");
  await tasksCore.createTask(w.db, { title: "dentro", clientId: a, dueDate: "2026-11-10", priority: "urgent" });
  await tasksCore.createTask(w.db, { title: "fuera", clientId: a, dueDate: "2026-12-10" });
  await tasksCore.createTask(w.db, { title: "sin fecha", clientId: b });
  const ids = await tasksCore.listTasks(w.db, { status: "open" });
  await tasksCore.setTaskStatus(w.db, ids.find((t) => t.title === "fuera").id, "completed");
  const inRange = await calendarTasks(w.db, { fromDay: "2026-11-01", toDay: "2026-11-30" });
  assert.deepEqual(inRange.map((t) => t.title), ["dentro"]);
  assert.equal((await calendarTasks(w.db, { fromDay: "2026-11-01", toDay: "2026-11-30", priority: "low" })).length, 0);
  assert.deepEqual((await calendarTasks(w.db, { undated: true })).map((t) => t.title), ["sin fecha"]);
  assert.equal((await calendarTasks(w.db, { undated: true, clientId: a })).length, 0);
});

test("umbrales: una sola fuente en config.js", () => {
  assert.deepEqual([C.CLIENT_REVIEW_STALE_DAYS, C.TASK_DUE_SOON_DAYS, C.CONTENT_UPCOMING_DAYS, C.PUBLICATION_RISK_HOURS], [3, 2, 7, 48]);
});
