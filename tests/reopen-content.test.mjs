import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as content from "../lib/studio/content-core.js";
import * as tokens from "../lib/mcp/tokens-core.js";
import * as actions from "../lib/portal/actions-core.js";
import { mintScope } from "../lib/portal/scope-core.js";
import { attemptLogin, resolveSessionCore } from "../lib/portal/auth-core.js";
import { hashToken } from "../lib/portal/token.js";
import { handleMcpRequest } from "../lib/mcp/http.js";
import { canStudioTransition, canTransition } from "../lib/shared/content.js";

async function world() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const cid = await clients.createClient(db, { name: "Torquen", monthly: 8 });
  const id = await content.createContent(db, cid, {
    title: "Reel publicado", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-20T18:00",
    copy: "Copy original", pillar: "Marca", cta: "Escribinos", status: "production",
  });
  await db.query(`UPDATE content_items SET status='published', published_at=now() WHERE id=$1`, [id]);
  return { db, cid, id };
}
const row = async (db, id) => (await db.query(`SELECT * FROM content_items WHERE id=$1`, [id]))[0];

test("Studio: published → production cambia solo el estado", async () => {
  const w = await world();
  const before = await row(w.db, w.id);
  const r = await content.reopenContent(w.db, w.id);
  assert.deepEqual([r.from, r.to], ["published", "production"]);
  const after = await row(w.db, w.id);
  assert.equal(after.status, "production");
  for (const k of ["title", "scheduled_at", "copy", "cta", "pillar", "platform", "content_type", "version", "client_id", "client_notes", "internal_notes", "published_at"]) {
    assert.deepEqual(after[k], before[k], k);
  }
});

test("Studio: reabrir registra activity y conserva el historial previo", async () => {
  const w = await world();
  await content.changeStatus(w.db, w.id, "production").catch(() => {}); // no-op esperado: published no transiciona
  const prior = await w.db.query(`SELECT count(*)::int n FROM activity_log WHERE content_id=$1`, [w.id]);
  await content.reopenContent(w.db, w.id);
  const [ev] = await w.db.query(`SELECT * FROM activity_log WHERE content_id=$1 AND event='content.reopened'`, [w.id]);
  assert.equal(ev.actor_type, "admin");
  assert.equal(ev.actor_name, "Stroka");
  assert.deepEqual(ev.data, { from: "published", to: "production" });
  assert.equal(ev.client_visible, false);
  const total = await w.db.query(`SELECT count(*)::int n FROM activity_log WHERE content_id=$1`, [w.id]);
  assert.equal(total[0].n, prior[0].n + 1);
  assert.ok((await content.contentHistory(w.db, w.id)).some((h) => h.event === "content.reopened"));
  assert.equal((await w.db.query(`SELECT count(*)::int n FROM content_items`))[0].n, 1, "sin duplicados");
});

test("reabrir solo aplica a published y a contenido existente", async () => {
  const w = await world();
  await content.reopenContent(w.db, w.id);
  await assert.rejects(content.reopenContent(w.db, w.id), (e) => e.status === 409);
  await assert.rejects(content.reopenContent(w.db, "no-existe"), (e) => e.status === 404);
});

test("las reglas generales no cambian: published sigue sin transiciones", async () => {
  assert.equal(canTransition("published", "production"), false);
  assert.equal(canStudioTransition("published", "production"), false);
  const w = await world();
  await assert.rejects(content.changeStatus(w.db, w.id, "production"), (e) => e.status === 409);
  assert.equal((await row(w.db, w.id)).status, "published");
});

test("MCP sigue sin poder sacar un contenido de published", async () => {
  const w = await world();
  const t = await tokens.createMcpToken(w.db, w.cid, { label: "Claude · T", canWrite: true });
  const deps = { db: w.db, failKey: () => "ip", allow: async () => true };
  const fetchImpl = (url, init) => handleMcpRequest(new Request(url, init), deps);
  const c = new Client({ name: "test", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL("http://mcp.test/api/mcp"), { fetch: fetchImpl, requestInit: { headers: { Authorization: `Bearer ${t.token}` } } }));
  const tools = (await c.listTools()).tools.map((x) => x.name);
  assert.ok(!tools.some((n) => /reopen|reabrir/i.test(n)));
  const r = await c.callTool({ name: "update_content", arguments: { content_id: w.id, expected_version: 1, patch: { status: "production" } } });
  assert.equal(r.isError, true);
  assert.equal(JSON.parse(r.content[0].text).error.code, "INVALID_TRANSITION");
  assert.equal((await row(w.db, w.id)).status, "published");
  assert.equal((await w.db.query(`SELECT 1 FROM activity_log WHERE event='content.reopened'`)).length, 0);
});

test("Portal cliente no puede reabrir (no tiene esa acción ni cambia published)", async () => {
  const w = await world();
  const PEPPER = "p".repeat(40);
  process.env.PORTAL_SECRET = PEPPER;
  const { code } = await clients.generateAccess(w.db, w.cid, { pepper: PEPPER });
  const login = await attemptLogin(w.db, { company: "Torquen", code, ipHash: "ip", pepper: PEPPER });
  const ses = await resolveSessionCore(w.db, hashToken(login.token));
  const scope = mintScope({ clientId: w.cid, source: "session", sessionId: ses.sessionId, displayName: ses.displayName });
  assert.ok(!Object.keys(actions).some((k) => /reopen|reabrir/i.test(k)));
  await assert.rejects(actions.approveContent(w.db, scope, { contentId: w.id, version: 1, name: "Ana B" }), (e) => [404, 409].includes(e.status));
  await assert.rejects(actions.requestChanges(w.db, scope, { contentId: w.id, version: 1, body: "cambios", name: "Ana B" }), (e) => [404, 409].includes(e.status));
  assert.equal((await row(w.db, w.id)).status, "published");
});

test("la ruta de reabrir exige sesión de Studio y nadie más la usa", () => {
  const route = readFileSync("app/api/studio/content/[id]/reopen/route.js", "utf8");
  assert.match(route, /studioRoute\(/, "pasa por guardApi (401 sin sesión)");
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const users = ["lib", "app", "components"].flatMap(walk).filter((f) => /\.(js|jsx|mjs)$/.test(f) && readFileSync(f, "utf8").includes("reopenContent"));
  assert.deepEqual(users.sort(), ["app/api/studio/content/[id]/reopen/route.js", "lib/studio/content-core.js", "lib/studio/server/content.js"].sort());
});
