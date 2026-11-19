// Smoke test of a DEPLOYED (Preview) MCP endpoint with a REAL MCP client over HTTPS.
// Tokens come ONLY from environment variables; nothing is written to disk and no
// token is ever printed (all output goes through redact()).
//
//   MCP_PREVIEW_URL=https://<preview>/api/mcp
//   MCP_TOKEN_TORQUEN / MCP_TOKEN_PISTACHIA / MCP_TOKEN_READONLY   (read-only token of ANY client)
//
// It creates a few test items on the two DEMO clients and cancels them at the end
// (there is no delete). Use demo clients only.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const URL_ = process.env.MCP_PREVIEW_URL;
const T = { torquen: process.env.MCP_TOKEN_TORQUEN, pistachia: process.env.MCP_TOKEN_PISTACHIA, readonly: process.env.MCP_TOKEN_READONLY };
const secrets = Object.values(T).filter(Boolean);
const redact = (s) => secrets.reduce((acc, t) => acc.split(t).join("«token»"), String(s));
const say = (...a) => console.log(redact(a.join(" ")));
if (!URL_ || secrets.length < 3 || Object.values(T).some((v) => !v)) {
  console.error("Faltan variables: MCP_PREVIEW_URL, MCP_TOKEN_TORQUEN, MCP_TOKEN_PISTACHIA, MCP_TOKEN_READONLY");
  process.exit(2);
}
if (!/^(https:\/\/.+|http:\/\/localhost:\d+)\/api\/mcp$/.test(URL_)) { console.error("MCP_PREVIEW_URL debe ser https://…/api/mcp"); process.exit(2); }

let n = 0, failed = 0;
const ok = (cond, msg, detail = "") => { n++; if (!cond) { failed++; say(`✗ ${msg}`, detail); } else say(`✓ ${msg}`); return cond; };
const stamp = Date.now().toString(36);

const connect = async (token) => {
  const c = new Client({ name: "mcp-preview-smoke", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(URL_), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return {
    c,
    call: async (name, args = {}) => {
      const r = await c.callTool({ name, arguments: args });
      return { isError: !!r.isError, body: JSON.parse(r.content[0].text) };
    },
  };
};
const raw = (token) => fetch(URL_, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
const code = (r) => r.body?.error?.code;
const created = { torquen: { content: [], tasks: [] }, pistachia: { content: [], tasks: [] } };

try {
  const month = "2026-11";
  // ---- Torquen
  const t = await connect(T.torquen);
  ok(t.c.getServerVersion()?.name === "stroka-studio", "1. initialize (Torquen)");
  const names = (await t.c.listTools()).tools.map((x) => x.name);
  ok(names.length === 8 && !names.some((x) => /delete/.test(x)), `2. list tools (${names.length}: ${names.join(", ")})`);
  const cl = (await t.call("get_client")).body;
  ok(cl.active === true && cl.permissions === "read_write" && cl.timezone === "America/Argentina/Buenos_Aires", `3. get_client → «${cl.name}», ${cl.permissions}, ${cl.timezone}`);
  const before = (await t.call("get_calendar", { month })).body;
  ok(Array.isArray(before.items), `4. get_calendar ${month} → ${before.count} items`);
  const c1 = await t.call("create_content", { title: `Prueba MCP ${stamp}`, scheduled_at: "2026-11-20T12:00", type: "reel", platform: "instagram", copy: "Contenido de prueba", pillar: "Prueba" });
  ok(!c1.isError && c1.body.status === "production" && c1.body.version === 1 && c1.body.time === "12:00", "5. create_content con copy (production, 12:00 BA)", JSON.stringify(c1.body));
  const id1 = c1.body.id; created.torquen.content.push(id1);
  const after = (await t.call("get_calendar", { month })).body;
  ok(after.items.some((i) => i.id === id1 && i.date === "2026-11-20") && after.count === before.count + 1, "6. calendario releído incluye el contenido nuevo");
  ok((await t.call("get_content", { content_id: id1 })).body.copy === "Contenido de prueba", "6b. get_content devuelve el copy");
  const u1 = await t.call("update_content", { content_id: id1, expected_version: 1, patch: { copy: "Copy actualizado", title: `Prueba MCP ${stamp} (editado)` } });
  ok(!u1.isError && u1.body.content.version === 2 && u1.body.content.title.endsWith("(editado)"), "7. update_content → version 2", JSON.stringify(u1.body));
  const stale = await t.call("update_content", { content_id: id1, expected_version: 1, patch: { title: "pisando" } });
  ok(stale.isError && code(stale) === "CONFLICT" && stale.body.error.current_version === 2 && stale.body.error.expected_version === 1, "8. expected_version viejo → CONFLICT");
  const tk = await t.call("create_task", { title: `Editar prueba MCP ${stamp}`, due_date: "2026-11-19", priority: "normal", content_id: id1 });
  ok(!tk.isError && tk.body.id, "9. create_task", JSON.stringify(tk.body));
  const tkId = tk.body.id; created.torquen.tasks.push(tkId);
  const ut = await t.call("update_task", { task_id: tkId, patch: { priority: "high", status: "in_progress" } });
  ok(!ut.isError && ut.body.task.priority === "high" && ut.body.task.status === "in_progress", "10. update_task", JSON.stringify(ut.body));
  const forb = await t.call("update_content", { content_id: id1, expected_version: 2, patch: { status: "approved" } }).catch(() => ({ isError: true }));
  ok(forb.isError, "10b. status approved rechazado por MCP");

  // ---- Pistachia
  const p = await connect(T.pistachia);
  const pcl = (await p.call("get_client")).body;
  ok(pcl.name && pcl.name !== cl.name, `Pistachia → get_client «${pcl.name}» (distinto de Torquen)`);
  ok(Array.isArray((await p.call("get_calendar", { month })).body.items), "Pistachia → get_calendar");
  const c2 = await p.call("create_content", { title: `Prueba MCP P ${stamp}`, scheduled_at: "2026-11-21T10:30", type: "post", platform: "instagram", copy: "Copy Pistachia" });
  ok(!c2.isError, "Pistachia → create_content con copy", JSON.stringify(c2.body));
  const id2 = c2.body.id; created.pistachia.content.push(id2);
  const u2 = await p.call("update_content", { content_id: id2, expected_version: 1, patch: { copy: "Copy Pistachia v2" } });
  ok(!u2.isError && u2.body.content.version === 2, "Pistachia → update_content");
  const tk2 = await p.call("create_task", { title: `Tarea P ${stamp}` });
  ok(!tk2.isError, "Pistachia → create_task");
  created.pistachia.tasks.push(tk2.body.id);
  ok(!(await p.call("update_task", { task_id: tk2.body.id, patch: { status: "completed" } })).isError, "Pistachia → update_task");

  // ---- aislamiento
  for (const [who, name, otherContent, otherTask] of [[t, "Torquen→Pistachia", id2, tk2.body.id], [p, "Pistachia→Torquen", id1, tkId]]) {
    const g = await who.call("get_content", { content_id: otherContent });
    ok(g.isError && code(g) === "NOT_FOUND", `${name} get_content = NOT_FOUND`);
    const w = await who.call("update_content", { content_id: otherContent, expected_version: 1, patch: { title: "hack" } });
    ok(w.isError && code(w) === "NOT_FOUND", `${name} update_content = NOT_FOUND`);
    const ut2 = await who.call("update_task", { task_id: otherTask, patch: { title: "hack" } });
    ok(ut2.isError && code(ut2) === "NOT_FOUND", `${name} update_task = NOT_FOUND`);
    const ct = await who.call("create_task", { title: "x", content_id: otherContent });
    ok(ct.isError && code(ct) === "NOT_FOUND", `${name} create_task con content ajeno = NOT_FOUND`);
  }
  const rejected = await t.call("get_calendar", { month, client_id: "cli_x" }).catch(() => ({ isError: true }));
  ok(rejected.isError, "client_id en el input es rechazado");

  // ---- read-only
  const r = await connect(T.readonly);
  const rcl = (await r.call("get_client")).body;
  ok(rcl.permissions === "read_only", `13. read-only → get_client «${rcl.name}», ${rcl.permissions}`);
  ok(!(await r.call("get_calendar", { month })).isError, "13. read-only get_calendar");
  const roTarget = rcl.name === cl.name ? id1 : rcl.name === pcl.name ? id2 : null;
  if (roTarget) ok(!(await r.call("get_content", { content_id: roTarget })).isError, "13. read-only get_content");
  else say("· read-only get_content omitido: el token pertenece a otro cliente (probado vía get_calendar)");
  const w1 = await r.call("create_content", { title: "x", scheduled_at: "2026-11-25T10:00", type: "post", platform: "instagram" });
  ok(w1.isError && code(w1) === "READ_ONLY", "14. read-only create_content → READ_ONLY");
  const w2 = await r.call("update_content", { content_id: roTarget || id1, expected_version: 1, patch: { title: "x" } });
  ok(w2.isError && code(w2) === "READ_ONLY", "14. read-only update_content → READ_ONLY");
  const w3 = await r.call("create_task", { title: "x" });
  ok(w3.isError && code(w3) === "READ_ONLY", "14. read-only create_task → READ_ONLY");
  const w4 = await r.call("update_task", { task_id: tkId, patch: { title: "x" } });
  ok(w4.isError && ["READ_ONLY"].includes(code(w4)), "14. read-only update_task → READ_ONLY");

  // ---- 401
  const bad = await raw("stk_mcp_" + "x".repeat(43));
  ok(bad.status === 401 && (await bad.json().catch(() => ({}))).error?.code === "AUTH_REQUIRED", "15. token inválido → 401 AUTH_REQUIRED", `status ${bad.status}`);
  const none = await raw();
  ok(none.status === 401 && (await none.json().catch(() => ({}))).error?.code === "AUTH_REQUIRED", "16. sin token → 401 AUTH_REQUIRED", `status ${none.status}`);
} catch (e) {
  failed++;
  say("✗ error inesperado:", e?.name, e?.message);
} finally {
  // Tidy the demo data (no delete exists): cancel what this run created.
  for (const [key, tok] of [["torquen", T.torquen], ["pistachia", T.pistachia]]) {
    try {
      const x = await connect(tok);
      for (const id of created[key].content) {
        const cur = (await x.call("get_content", { content_id: id })).body;
        if (cur.version) await x.call("update_content", { content_id: id, expected_version: cur.version, patch: { status: "cancelled" } });
      }
      for (const id of created[key].tasks) await x.call("update_task", { task_id: id, patch: { status: "cancelled" } });
    } catch (e) { say("· limpieza parcial", key, e?.message); }
  }
  say("\n17. Activity: no es legible por MCP. Verificala en Studio → cliente → Actividad.");
  say("   Contenido Torquen:", created.torquen.content.join(","), "| tarea:", created.torquen.tasks.join(","));
  say("   Contenido Pistachia:", created.pistachia.content.join(","), "| tarea:", created.pistachia.tasks.join(","));
  say(failed ? `\nFALLÓ: ${failed} de ${n} checks` : `\nOK: ${n} checks`);
  process.exitCode = failed ? 1 : 0;
}
