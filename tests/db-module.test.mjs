// Ejercita el db.js REAL (rama PGlite) en un directorio temporal: arranque
// limpio → migración aplicada → segundo arranque en frío sin cambios.
// `server-only` solo se resuelve con la condición react-server, igual que en Next.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("getDb() real: migra una base nueva y reabre sin reaplicar", () => {
  const dir = mkdtempSync(join(tmpdir(), "stk-db-"));
  const script = `
    process.env.NODE_ENV = "development"; delete process.env.DATABASE_URL;
    const { getDb } = await import(${JSON.stringify(resolve("lib/studio/server/db.js"))});
    const db = await getDb();
    const m = await db.query("SELECT id, mode FROM schema_migrations");
    const t = await db.tx(async (t) => (await t.query("SELECT 1 AS x"))[0].x);
    console.log(JSON.stringify({ m, t }));
    process.exit(0);`;
  try {
    const run = () => spawnSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", script], { cwd: dir, encoding: "utf8", env: { ...process.env, NODE_PATH: resolve("node_modules") } });
    const a = run();
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, /baseline-studio-schema\): applied/);
    const out1 = JSON.parse(a.stdout.trim().split("\n").pop());
    assert.deepEqual(out1.m, [{ id: 1, mode: "applied" }, { id: 2, mode: "applied" }]);
    assert.match(a.stdout, /portal-phase1-clients-content\): applied/);
    assert.equal(out1.t, 1);
    const b = run();
    assert.equal(b.status, 0, b.stderr);
    assert.doesNotMatch(b.stdout, /migración/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
