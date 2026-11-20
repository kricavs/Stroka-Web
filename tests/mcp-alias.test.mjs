import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as tokens from "../lib/mcp/tokens-core.js";
import { handleMcpRequest, isValidMcpAlias } from "../lib/mcp/http.js";

const BASE = "http://mcp.test";

async function world() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const A = await clients.createClient(db, { name: "Torquen", monthly: 8 });
  const B = await clients.createClient(db, { name: "Pistachia", monthly: 4 });
  const tA = await tokens.createMcpToken(db, A, { label: "Claude · Torquen", canWrite: true });
  const tB = await tokens.createMcpToken(db, B, { label: "Claude · Pistachia", canWrite: true });
  const tBro = await tokens.createMcpToken(db, B, { label: "Claude · Lectura Pistachia", canWrite: false });
  const deps = { db, failKey: () => "ip", allow: async () => true };
  // The alias lives only in the URL path; handleMcpRequest never receives it separately.
  const fetchImpl = (url, init) => handleMcpRequest(new Request(url, init), deps);
  const connect = async (path, token) => {
    const c = new Client({ name: "test", version: "1.0.0" });
    await c.connect(new StreamableHTTPClientTransport(new URL(BASE + path), {
      fetch: fetchImpl, requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    }));
    const call = async (name, args = {}) => {
      const r = await c.callTool({ name, arguments: args });
      return { isError: Boolean(r.isError), body: JSON.parse(r.content[0].text) };
    };
    return { c, call };
  };
  const raw = (path, headers = {}) => fetchImpl(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  return { db, A, B, tA, tB, tBro, connect, raw };
}
const who = async (w, path, token) => (await (await w.connect(path, token)).call("get_client")).body.name;

test("alias: /api/mcp sigue funcionando y /api/mcp/<alias> inicializa MCP", async () => {
  const w = await world();
  for (const path of ["/api/mcp", "/api/mcp/torquen", "/api/mcp/pistachia", "/api/mcp/cliente-x"]) {
    const { c } = await w.connect(path, w.tA.token);
    assert.equal(c.getServerVersion().name, "stroka-studio", path);
    assert.equal((await c.listTools()).tools.length, 8, path);
  }
});

test("seguridad: el alias NO tiene autoridad — el cliente sale solo del token", async () => {
  const w = await world();
  assert.equal(await who(w, "/api/mcp", w.tA.token), "Torquen");
  assert.equal(await who(w, "/api/mcp/torquen", w.tA.token), "Torquen");
  assert.equal(await who(w, "/api/mcp/pistachia", w.tB.token), "Pistachia");
  // cruzado: token Pistachia + /torquen sigue siendo Pistachia (y al revés)
  assert.equal(await who(w, "/api/mcp/torquen", w.tB.token), "Pistachia");
  assert.equal(await who(w, "/api/mcp/pistachia", w.tA.token), "Torquen");
});

test("seguridad: los datos también siguen el token, no la URL", async () => {
  const w = await world();
  const own = await w.connect("/api/mcp/torquen", w.tB.token); // token Pistachia en URL "torquen"
  const created = await own.call("create_content", { title: "Solo de Pistachia", scheduled_at: "2026-11-25T10:00", type: "post", platform: "instagram" });
  assert.equal(created.isError, false);
  const [row] = await w.db.query(`SELECT client_id FROM content_items WHERE id=$1`, [created.body.id]);
  assert.equal(row.client_id, w.B);
  const other = await w.connect("/api/mcp/pistachia", w.tA.token); // token Torquen ve NOT_FOUND de Pistachia
  const r = await other.call("get_content", { content_id: created.body.id });
  assert.equal(r.isError, true);
  assert.equal(r.body.error.code, "NOT_FOUND");
});

test("alias: sin token / token inválido → AUTH_REQUIRED en cualquier ruta", async () => {
  const w = await world();
  for (const path of ["/api/mcp", "/api/mcp/torquen"]) {
    let r = await w.raw(path);
    assert.equal(r.status, 401, path);
    assert.equal((await r.json()).error.code, "AUTH_REQUIRED");
    r = await w.raw(path, { authorization: "Bearer stk_mcp_nope" });
    assert.equal(r.status, 401);
  }
});

test("alias: read-only sigue siendo read-only", async () => {
  const w = await world();
  const { call } = await w.connect("/api/mcp/torquen", w.tBro.token);
  assert.equal((await call("get_client")).body.name, "Pistachia");
  const r = await call("create_content", { title: "x", scheduled_at: "2026-11-25T10:00", type: "post", platform: "instagram" });
  assert.equal(r.isError, true);
  assert.equal(r.body.error.code, "READ_ONLY");
});

test("alias: ninguna herramienta recibe client_id (ni desde el alias ni desde el input)", async () => {
  const w = await world();
  const { c, call } = await w.connect("/api/mcp/pistachia", w.tA.token);
  assert.ok(!JSON.stringify((await c.listTools()).tools).includes("client_id"));
  const r = await call("get_calendar", { month: "2026-11", client_id: w.B }).catch(() => ({ isError: true }));
  assert.equal(r.isError, true);
});

test("alias: validación de forma y cableado de la ruta", () => {
  for (const ok of ["torquen", "pistachia", "cliente-x", "a1", "x".repeat(64)]) assert.equal(isValidMcpAlias(ok), true, ok);
  for (const bad of ["", "Torquen", "a_b", "a b", "../x", "a/b", "x".repeat(65), "ñ", undefined, null, 5]) assert.equal(isValidMcpAlias(bad), false, String(bad));
  const route = readFileSync("lib/mcp/server/route.js", "utf8");
  assert.match(route, /mcpAliasRoute[\s\S]*return mcpRoute\(req\);/, "el alias se descarta: solo se pasa req");
  assert.ok(!/alias/.test(readFileSync("lib/mcp/tokens-core.js", "utf8")), "la auth no conoce el alias");
  assert.ok(!/alias/i.test(readFileSync("lib/mcp/server.js", "utf8")) && !/alias/i.test(readFileSync("lib/mcp/tools-core.js", "utf8")));
});
