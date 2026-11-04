import test from "node:test";
import assert from "node:assert/strict";
import { mintScope, isScope, assertScope, assertWritable, guardScopedSql, scopedRunner } from "../lib/portal/scope-core.js";

test("solo mintScope produce scopes; los datos de un request nunca", () => {
  const s = mintScope({ clientId: "c1", source: "session", sessionId: "s1", displayName: "Ana" });
  assert.ok(isScope(s));
  assert.equal(Object.isFrozen(s), true);
  assert.equal(isScope({ clientId: "c1" }), false);
  assert.equal(isScope(JSON.parse('{"clientId":"c1","source":"session"}')), false);
  assert.equal(isScope(null), false);
  assert.throws(() => assertScope({ clientId: "c1" }));
  assert.throws(() => mintScope({ clientId: "", source: "session" }));
  assert.throws(() => mintScope({ clientId: "c1", source: "otro" }));
  assert.throws(() => { s.clientId = "c2"; }, TypeError); // congelado (modo estricto de módulo ESM)
});

test("la vista admin puede leer pero no actuar como el cliente", () => {
  const preview = mintScope({ clientId: "c1", source: "admin-preview" });
  assert.ok(isScope(preview));
  assert.throws(() => assertWritable(preview), /Modo vista cliente/);
  assert.doesNotThrow(() => assertWritable(mintScope({ clientId: "c1", source: "session" })));
});

test("guard de SQL: exige client_id = $1", () => {
  assert.doesNotThrow(() => guardScopedSql("SELECT * FROM content_items WHERE client_id = $1 AND id = $2"));
  assert.doesNotThrow(() => guardScopedSql("select 1 from t where CLIENT_ID=$1"));
  assert.throws(() => guardScopedSql("SELECT * FROM content_items WHERE id = $2"));
  assert.throws(() => guardScopedSql("SELECT * FROM content_items WHERE client_id = $2"));
  assert.throws(() => guardScopedSql("SELECT * FROM clients WHERE id = $1")); // requiere opts.self
  assert.doesNotThrow(() => guardScopedSql("SELECT * FROM clients WHERE id = $1", { self: true }));
  assert.throws(() => guardScopedSql("SELECT * FROM content_items WHERE id = $1", { self: true }));
});

test("scopedRunner inyecta el client_id como $1 y rechaza scopes falsos", async () => {
  const calls = [];
  const run = scopedRunner(async (sql, params) => (calls.push({ sql, params }), []), mintScope({ clientId: "c9", source: "session" }));
  await run("SELECT 1 FROM x WHERE client_id = $1 AND id = $2", ["abc"]);
  assert.deepEqual(calls[0].params, ["c9", "abc"]);
  assert.throws(() => run("SELECT 1 FROM x WHERE id = $2", ["abc"]));
  assert.equal(calls.length, 1);
  assert.throws(() => scopedRunner(async () => [], { clientId: "c9" }));
});
