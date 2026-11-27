import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as content from "../lib/studio/content-core.js";
import * as tasks from "../lib/studio/tasks-core.js";
import * as files from "../lib/files/files-core.js";
import * as planner from "../lib/planner/drafts-core.js";
import * as tokens from "../lib/mcp/tokens-core.js";
import * as actions from "../lib/portal/actions-core.js";
import { contentRepo } from "../lib/portal/content-core.js";
import { filesRepo } from "../lib/portal/files-core.js";
import { assertScope, mintScope, scopedRunner } from "../lib/portal/scope-core.js";
import { attemptLogin, resolveSessionCore } from "../lib/portal/auth-core.js";
import { hashToken } from "../lib/portal/token.js";
import { calendarTasks, getOperations } from "../lib/operations/queries-core.js";
import { handleMcpRequest } from "../lib/mcp/http.js";
import { createSessionToken, verifySessionToken } from "../lib/studio/session.js";
import { EVENT_LABEL, STATUSES } from "../lib/shared/content.js";
import { monthRange } from "../lib/shared/time.js";

const PEPPER = "p".repeat(40);
process.env.PORTAL_SECRET = PEPPER;
const NOW = new Date("2026-11-16T15:00:00Z");
const MONTH = "2026-11";

const one = async (db, sql, p) => (await db.query(sql, p))[0];
const count = async (db, table, where = "true", p) => (await one(db, `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p)).n;
const row = (db, id) => one(db, `SELECT * FROM content_items WHERE id = $1`, [id]);
const sq = (db) => (scope, sql, params = [], opts) => (assertScope(scope), scopedRunner(db.query, scope)(sql, params, opts));

const make = (db, cid, over = {}) => content.createContent(db, cid, {
  title: "Reel a borrar", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-18T18:00", status: "production", ...over,
});
const force = (db, id, status) => db.query(`UPDATE content_items SET status = $2 WHERE id = $1`, [id, status]);

async function world() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const cid = await clients.createClient(db, { name: "Torquen", monthly: 8 });
  const { code } = await clients.generateAccess(db, cid, { pepper: PEPPER });
  const login = await attemptLogin(db, { company: "Torquen", code, ipHash: "ip", pepper: PEPPER });
  const ses = await resolveSessionCore(db, hashToken(login.token));
  const scope = mintScope({ clientId: cid, source: "session", sessionId: ses.sessionId, displayName: "Ana B" });
  const id = await make(db, cid);
  return { db, cid, id, scope };
}

// A content with real history (comment, client change request + its automatic task,
// a manual task, a file) that ends up cancelled.
async function worldWithHistory() {
  const w = await world();
  await content.addStudioComment(w.db, w.id, "Comentario de Studio");
  await content.changeStatus(w.db, w.id, "review");
  await content.changeStatus(w.db, w.id, "client_review");
  const { taskId } = await actions.requestChanges(w.db, w.scope, { contentId: w.id, version: 1, body: "Cambiar el final", name: "Ana B" });
  const manualId = await tasks.createTask(w.db, { title: "Devolver equipo", contentId: w.id, visibility: "client", priority: "normal", dueDate: "2026-11-10" });
  await w.db.query(
    `INSERT INTO client_files (id, client_id, content_id, category, name, original_name, blob_pathname, mime, size, group_key, uploaded_by_type)
     VALUES ('fil_1', $1, $2, 'deliverables', 'Entrega', 'e.pdf', 'clients/x/e.pdf', 'application/pdf', 10, 'fil_1', 'studio')`,
    [w.cid, w.id]
  );
  await content.changeStatus(w.db, w.id, "cancelled");
  return { ...w, taskId, manualId };
}

async function mcpFor(w) {
  const t = await tokens.createMcpToken(w.db, w.cid, { label: "Claude · T", canWrite: true });
  const deps = { db: w.db, failKey: () => "ip", allow: async () => true };
  const c = new Client({ name: "test", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL("http://mcp.test/api/mcp"), {
    fetch: (url, init) => handleMcpRequest(new Request(url, init), deps),
    requestInit: { headers: { Authorization: `Bearer ${t.token}` } },
  }));
  const call = async (name, args = {}) => {
    const r = await c.callTool({ name, arguments: args });
    return { isError: Boolean(r.isError), body: JSON.parse(r.content[0].text) };
  };
  return { client: c, call };
}

test("migración 7: columnas nullable y los contenidos existentes quedan intactos", async () => {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS.filter((m) => m.id < 7));
  await db.query(`INSERT INTO clients (id, name, display_name, slug, login_key) VALUES ('c1','A','A','a','a')`);
  await db.query(`INSERT INTO content_items (id, client_id, title, platform, content_type, status) VALUES ('x','c1','t','instagram','reel','cancelled')`);
  const before = await row(db, "x");
  assert.deepEqual((await runMigrations(db, MIGRATIONS)).applied.map((m) => m.id), [7]);
  const { deleted_at, deleted_by, ...after } = await row(db, "x");
  assert.deepEqual([deleted_at, deleted_by], [null, null]);
  assert.deepEqual(after, before);
});

test("1/14. cancelled se elimina (soft) y registra content.deleted", async () => {
  const w = await world();
  await content.changeStatus(w.db, w.id, "cancelled");
  assert.deepEqual(await content.deleteContent(w.db, w.id), { deleted: true, clientId: w.cid });
  const after = await row(w.db, w.id);
  assert.ok(after.deleted_at, "la fila sigue existiendo, marcada");
  assert.equal(after.deleted_by, "Stroka");
  assert.equal(after.status, "cancelled");
  const [ev] = await w.db.query(`SELECT * FROM activity_log WHERE event = 'content.deleted'`);
  assert.equal(ev.content_id, w.id);
  assert.deepEqual([ev.actor_type, ev.actor_name, ev.client_visible], ["admin", "Stroka", false]);
  assert.deepEqual(ev.data, {
    content_id: w.id, title: "Reel a borrar", previous_status: "cancelled", deleted_at: after.deleted_at.toISOString(), actor: "Studio",
  });
  assert.equal(EVENT_LABEL["content.deleted"], "Contenido eliminado");
});

test("2/3. ningún estado distinto de cancelled puede eliminarse (409)", async () => {
  const w = await world();
  for (const status of STATUSES.filter((s) => s !== "cancelled")) {
    await force(w.db, w.id, status);
    await assert.rejects(content.deleteContent(w.db, w.id), (e) => e.status === 409, status);
  }
  assert.equal((await row(w.db, w.id)).deleted_at, null);
  assert.equal(await count(w.db, "activity_log", "event = 'content.deleted'"), 0);
});

test("16. doble eliminación e id inexistente se rechazan", async () => {
  const w = await world();
  await content.changeStatus(w.db, w.id, "cancelled");
  await content.deleteContent(w.db, w.id);
  const first = (await row(w.db, w.id)).deleted_at;
  await assert.rejects(content.deleteContent(w.db, w.id), (e) => e.status === 404);
  await assert.rejects(content.deleteContent(w.db, "cnt_nope"), (e) => e.status === 404);
  assert.deepEqual((await row(w.db, w.id)).deleted_at, first);
  assert.equal(await count(w.db, "activity_log", "event = 'content.deleted'"), 1);
});

test("4. la ruta exige sesión de Studio: sin cookie o con token ajeno no hay sesión", async () => {
  process.env.STUDIO_SESSION_SECRET = "s".repeat(40);
  const route = readFileSync("app/api/studio/content/[id]/delete/route.js", "utf8");
  assert.match(route, /studioRoute\(/, "guardApi → 401 antes de tocar la base");
  assert.match(readFileSync("lib/studio/server/auth.js", "utf8"), /status: 401/);
  assert.equal(await verifySessionToken(undefined), false);
  assert.equal(await verifySessionToken("token-de-portal"), false);
  assert.equal(await verifySessionToken(await createSessionToken()), true);
});

test("5/6. Portal y MCP no tienen forma de eliminar", async () => {
  const w = await world();
  assert.ok(!Object.keys(actions).some((k) => /delete|remove|eliminar/i.test(k)));
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const users = ["lib", "app", "components"].flatMap(walk).filter((f) => /\.(js|jsx|mjs)$/.test(f) && /deleteContent/.test(readFileSync(f, "utf8")));
  assert.deepEqual(users.sort(), ["app/api/studio/content/[id]/delete/route.js", "lib/studio/content-core.js", "lib/studio/server/content.js"].sort());
  assert.ok(!existsSync("app/api/portal/content/[id]/delete"));
  const mcp = await mcpFor(w);
  const names = (await mcp.client.listTools()).tools.map((t) => t.name);
  assert.ok(names.length > 0 && !names.some((n) => /delete|remove|eliminar/i.test(n)), names.join());
});

test("7/8. desaparece de calendarios, Contenidos y detalle; las escrituras lo tratan como inexistente", async () => {
  const w = await worldWithHistory();
  const undated = await make(w.db, w.cid, { title: "Sin fecha", scheduledLocal: "" });
  await content.changeStatus(w.db, undated, "cancelled");
  const range = monthRange(MONTH);
  assert.equal((await content.listContent(w.db, { clientId: w.cid })).length, 2, "cancelado (no eliminado) sigue visible");
  await content.deleteContent(w.db, w.id);
  await content.deleteContent(w.db, undated);
  for (const f of [{}, { clientId: w.cid }, { clientId: w.cid, range }, { clientId: w.cid, undated: true }, { status: "cancelled" }]) {
    assert.deepEqual(await content.listContent(w.db, f), [], JSON.stringify(f));
  }
  assert.equal(await content.getContent(w.db, w.id), null);
  assert.deepEqual(await content.clientMonthStats(w.db, w.cid, range), {});
  const nf = (p) => assert.rejects(p, (e) => e.status === 404);
  await nf(content.updateContent(w.db, w.id, { title: "x" }));
  await nf(content.changeStatus(w.db, w.id, "idea"));
  await nf(content.reopenContent(w.db, w.id));
  await nf(content.addStudioComment(w.db, w.id, "x"));
  await nf(content.registerExternalApproval(w.db, w.id, { approverName: "Ana B" }));
  await nf(tasks.createTask(w.db, { title: "x", contentId: w.id, priority: "normal" }));
  await assert.rejects(files.prepareUpload(w.db, { clientId: w.cid, category: "deliverables", filename: "a.pdf", size: 10, contentId: w.id }, { secret: PEPPER }), /no pertenece/);
});

test("9/10. operations, dashboard, tareas y objetivo mensual Reel + Carrusel", async () => {
  const w = await worldWithHistory();
  // A cancelled row already doesn't count; force a "live" status next to the mark to prove the filter itself.
  const keep = await make(w.db, w.cid, { title: "Carrusel vivo", contentType: "carousel" });
  await content.deleteContent(w.db, w.id);
  await force(w.db, w.id, "production");

  const ops = await getOperations(w.db, { now: NOW });
  assert.ok(!JSON.stringify(ops).includes(w.id), "ni contenido, ni alertas, ni actividad, ni links");
  assert.ok(!JSON.stringify(ops).includes("Reel a borrar"));
  assert.equal(ops.clients[0].progress.planned, 1, "solo cuenta el carrusel vivo");
  const dash = await content.dashboardData(w.db, { today: monthRange(MONTH), upcoming: monthRange(MONTH) });
  assert.deepEqual([...new Set(Object.values(dash).flat().map((c) => c.id))], [keep]);
  const [c] = await clients.listClients(w.db, { month: MONTH, monthStart: monthRange(MONTH).start, monthEnd: monthRange(MONTH).end, now: NOW });
  assert.deepEqual([c.month_count, c.month_published, c.pending], [1, 0, 0]);

  // The automatic change-request task leaves operation; the manual one stays without the content.
  const open = await tasks.listTasks(w.db, { clientId: w.cid, status: "open" });
  assert.deepEqual(open.map((t) => [t.id, t.content_id, t.content_title]), [[w.manualId, null, null]]);
  assert.deepEqual(await tasks.taskCounts(w.db, "2026-11-16"), { overdue: 1, due_today: 0 });
  const cal = await calendarTasks(w.db, { clientId: w.cid, undated: true });
  assert.ok(!cal.some((t) => t.id === w.taskId));
  assert.equal((await tasks.getTask(w.db, w.manualId)).content_id, null);

  // Editing the surviving task keeps the historical link in the database.
  await tasks.updateTask(w.db, w.manualId, { title: "Devolver equipo hoy" });
  await tasks.setTaskStatus(w.db, w.manualId, "completed");
  assert.equal((await one(w.db, `SELECT content_id FROM tasks WHERE id = $1`, [w.manualId])).content_id, w.id);
});

test("11. Portal: no aparece en listas, detalle, resumen, pendientes, comentarios ni archivos", async () => {
  const w = await worldWithHistory();
  await content.deleteContent(w.db, w.id);
  await force(w.db, w.id, "client_review"); // proves the filter, not just the status
  const repo = contentRepo(sq(w.db));
  const range = monthRange(MONTH);
  assert.deepEqual(await repo.listVisible(w.scope, range), []);
  assert.equal(await repo.getVisible(w.scope, w.id), null);
  assert.equal(await repo.nextPublication(w.scope, NOW), null);
  assert.deepEqual(await repo.listComments(w.scope, w.id), []);
  assert.equal((await repo.pendingCounts(w.scope)).review, 0);
  const pending = await repo.listPending(w.scope, NOW);
  assert.deepEqual(pending.map((p) => [p.kind, p.task?.contentId, p.task?.contentTitle]), [["task", null, null]]);
  assert.ok(!JSON.stringify(await repo.monthSummary(w.scope, MONTH)).includes('"review":1'));
  const f = filesRepo(sq(w.db));
  assert.deepEqual(await f.listFiles(w.scope), []);
  assert.deepEqual(await f.listForContent(w.scope, w.id), []);
  assert.equal(await f.getForDownload(w.scope, "fil_1"), null);
  await assert.rejects(actions.approveContent(w.db, w.scope, { contentId: w.id, version: 1 }), (e) => e.status === 404);
  await assert.rejects(actions.requestChanges(w.db, w.scope, { contentId: w.id, version: 1, body: "x" }), (e) => e.status === 404);
  await assert.rejects(actions.addClientComment(w.db, w.scope, { contentId: w.id, body: "hola" }), (e) => e.status === 404);
});

test("12/13. MCP: NOT_FOUND igual que un contenido ajeno, fuera de calendar y pending", async () => {
  const w = await worldWithHistory();
  const mcp = await mcpFor(w);
  await content.deleteContent(w.db, w.id);
  await force(w.db, w.id, "changes_requested");

  const got = await mcp.call("get_content", { content_id: w.id });
  const foreign = await mcp.call("get_content", { content_id: "cnt_de_otro" });
  assert.equal(got.isError, true);
  assert.deepEqual(got.body, foreign.body);
  assert.equal(got.body.error.code, "NOT_FOUND");
  assert.equal((await mcp.call("update_content", { content_id: w.id, expected_version: 1, patch: { title: "x" } })).body.error.code, "NOT_FOUND");
  assert.equal((await mcp.call("create_task", { title: "x", content_id: w.id })).body.error.code, "NOT_FOUND");
  assert.equal((await mcp.call("get_calendar", { month: MONTH })).body.count, 0);
  const pending = (await mcp.call("get_pending")).body;
  assert.ok(!JSON.stringify(pending).includes(w.id));
  assert.deepEqual(pending.open_tasks.map((t) => t.id), [w.manualId]);
});

test("15. comments, approvals, tareas, archivos y actividad se conservan", async () => {
  const w = await worldWithHistory();
  const tables = ["content_comments", "content_approvals", "tasks", "client_files", "activity_log", "content_items"];
  const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(w.db, t)])));
  const before = await snapshot();
  await content.deleteContent(w.db, w.id);
  assert.deepEqual(await snapshot(), { ...before, activity_log: before.activity_log + 1 });
  for (const t of ["content_comments", "content_approvals", "client_files"]) assert.ok((await count(w.db, t, "content_id = $1", [w.id])) > 0, t);
  assert.ok((await content.contentHistory(w.db, w.id)).some((h) => h.event === "content.deleted"));
  const activity = await clients.listActivity(w.db, w.cid, 100);
  const ev = activity.find((a) => a.event === "content.deleted");
  assert.deepEqual([ev.content_title, ev.content_deleted], ["Reel a borrar", true]);
  const [file] = await files.listClientFiles(w.db, w.cid);
  assert.deepEqual([file.id, file.content_id, file.content_title], ["fil_1", null, null]);
});

test("17. reimportar el plan no actualiza ni revive el contenido eliminado", async () => {
  const w = await world();
  await w.db.query(`DELETE FROM activity_log`);
  await w.db.query(`DELETE FROM content_items`);
  const draft = async (title) => (await planner.createPlanningDraft(w.db, {
    sourceType: "manual", clientId: w.cid, defaultPlatform: "instagram", period: MONTH,
    items: [{ date: "2026-11-20", externalCode: "R1", format: "Reel", title }],
  })).id;
  const read = (id) => planner.getPlanningDraft(w.db, w.cid, id);

  const first = await draft("Lanzamiento");
  await planner.applyPlanningDraft(w.db, w.cid, first);
  const old = (await one(w.db, `SELECT content_id FROM planning_content_links`)).content_id;
  const staleBeforeDelete = await draft("Lanzamiento v2"); // previewed as "update" before deleting
  assert.equal((await read(staleBeforeDelete)).items[0].action, "update");

  await content.changeStatus(w.db, old, "cancelled");
  await content.deleteContent(w.db, old);
  const frozen = await row(w.db, old);

  // A draft analysed before the deletion cannot update it either.
  assert.deepEqual(await planner.applyPlanningDraft(w.db, w.cid, staleBeforeDelete), { created: 0, updated: 0, skipped: 1, noChange: 0 });

  // Same or changed file: reported, skipped by default.
  for (const title of ["Lanzamiento", "Lanzamiento v3"]) {
    const d = await read(await draft(title));
    assert.deepEqual([d.items[0].action, d.items[0].analysis.matchKind, d.items[0].resolution], ["possible_duplicate", "deleted", null]);
    assert.deepEqual([d.summary.create, d.summary.update, d.summary.skip, d.summary.deletedSkipped, d.summary.duplicatesSkipped], [0, 0, 1, 1, 0]);
    assert.deepEqual(d.orphans, []);
  }
  assert.equal(await count(w.db, "content_items"), 1);

  // Explicit request: a NEW content, the link moves to it, the deleted one stays deleted.
  const again = await draft("Lanzamiento v4");
  const [item] = (await read(again)).items;
  await planner.updatePlanningDraftItem(w.db, w.cid, again, item.id, { resolution: "create" });
  assert.equal((await planner.applyPlanningDraft(w.db, w.cid, again)).created, 1);
  const link = await one(w.db, `SELECT content_id FROM planning_content_links`);
  assert.notEqual(link.content_id, old);
  assert.deepEqual(await row(w.db, old), frozen);
  assert.deepEqual((await planner.getPlanningMonth(w.db, w.cid, MONTH)).contents.map((c) => c.id), [link.content_id]);
});
