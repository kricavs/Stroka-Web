// LOCAL/PREVIEW smoke test of the MCP endpoint with a REAL MCP client over real HTTP.
//
//   npm run dev   (other terminal)
//   node --env-file=.env.local scripts/mcp-smoke.mjs [baseUrl]
//
// Needs STUDIO_SESSION_SECRET (signs a Studio cookie to create two throw-away
// clients + tokens through the Studio API, exactly as the UI does). It creates
// "MCP Smoke A/B" clients and leaves them INACTIVE at the end. Dev databases only.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { SESSION_COOKIE, createSessionToken } from "../lib/studio/session.js";

const base = process.argv[2] || "http://localhost:3000";
const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
const studio = async (path, method = "GET", body) => {
  const r = await fetch(base + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
};
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error(`✗ ${msg}`); process.exitCode = 1; } else console.log(`✓ ${msg}`); };

const stamp = Date.now().toString(36);
const mkClient = async (name) => (await studio("/api/studio/clients", "POST", { name: `${name} ${stamp}`, monthly: 4 })).id;
const A = await mkClient("MCP Smoke A");
const B = await mkClient("MCP Smoke B");
const tA = await studio(`/api/studio/clients/${A}/mcp-tokens`, "POST", { label: "Claude · Smoke A", canWrite: true });
const tB = await studio(`/api/studio/clients/${B}/mcp-tokens`, "POST", { label: "Claude · Smoke B", canWrite: true });
ok(tA.token.startsWith("stk_mcp_") && tA.url.endsWith("/api/mcp"), "tokens generados desde la API de Studio");

const connect = async (token) => {
  const c = new Client({ name: "mcp-smoke", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return { c, call: async (name, args = {}) => { const r = await c.callTool({ name, arguments: args }); return { isError: !!r.isError, body: JSON.parse(r.content[0].text) }; } };
};

const a = await connect(tA.token);                       // 1 initialize
ok(a.c.getServerVersion()?.name === "stroka-studio", "1. initialize");
const tools = (await a.c.listTools()).tools;             // 2 list tools
ok(tools.length === 8, `2. list tools (${tools.map((t) => t.name).join(", ")})`);
const month = "2026-11";
let cal = (await a.call("get_calendar", { month })).body; // 3
ok(cal.count === 0, "3. get_calendar vacío");
const created = (await a.call("create_content", { title: "Reel smoke", scheduled_at: "2026-11-20T18:00", type: "reel", platform: "instagram", pillar: "Prueba" })).body; // 4
ok(created.id && created.status === "production" && created.version === 1, "4. create_content");
cal = (await a.call("get_calendar", { month })).body;     // 5
ok(cal.count === 1 && cal.items[0].id === created.id && cal.items[0].time === "18:00", "5. get_calendar ve el contenido (hora BA)");
const upd = (await a.call("update_content", { content_id: created.id, expected_version: 1, patch: { title: "Reel smoke v2" } })).body; // 6
ok(upd.content?.version === 2 && upd.content.title === "Reel smoke v2", "6. update_content → version 2");
const stale = await a.call("update_content", { content_id: created.id, expected_version: 1, patch: { title: "pisando" } }); // 7
ok(stale.isError && stale.body.error.code === "CONFLICT" && stale.body.error.current_version === 2, "7. conflicto de versión (CONFLICT)");
const b = await connect(tB.token);                        // 8
ok((await b.call("get_calendar", { month })).body.count === 0, "8a. token B no ve el calendario de A");
const cross = await b.call("get_content", { content_id: created.id });
ok(cross.isError && cross.body.error.code === "NOT_FOUND", "8b. token B → contenido de A = NOT_FOUND");
const crossW = await b.call("update_content", { content_id: created.id, expected_version: 2, patch: { title: "hack" } });
ok(crossW.isError && crossW.body.error.code === "NOT_FOUND", "8c. token B no puede modificar A");
const bc = (await b.call("create_content", { title: "Reel B", scheduled_at: "2026-11-21T10:00", type: "post", platform: "instagram" })).body;
ok((await a.call("get_calendar", { month })).body.items.every((i) => i.id !== bc.id), "8d. A no ve lo de B (y B puede modificar B)");
const raw = (token) => fetch(`${base}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
ok((await raw()).status === 401 && (await raw("stk_mcp_invalido")).status === 401, "sin token / token inválido → 401");
await studio(`/api/studio/clients/${A}/mcp-tokens/${tA.id}`, "DELETE"); // 9
const after = await raw(tA.token);                         // 10
ok(after.status === 401 && (await after.json()).error.code === "TOKEN_REVOKED", "9-10. revocado → 401 TOKEN_REVOKED");
ok((await b.call("get_client")).body.name.startsWith("MCP Smoke B"), "token B sigue funcionando tras revocar A");
for (const id of [A, B]) await studio(`/api/studio/clients/${id}`, "PATCH", { active: false }).catch(() => {});
console.log(process.exitCode ? `\nFALLÓ (${n} checks)` : `\nOK (${n} checks)`);
