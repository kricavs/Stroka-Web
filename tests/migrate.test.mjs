import test from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import { memoryDb } from "./helpers.mjs";

const modes = async (db) => (await db.query(`SELECT id, mode FROM schema_migrations ORDER BY id`)).map((r) => `${r.id}:${r.mode}`);
const tableExists = async (db, t) => (await db.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [t]))[0].ok;

test("base nueva: aplica el baseline y es idempotente", async () => {
  const db = memoryDb();
  const r1 = await runMigrations(db, MIGRATIONS);
  assert.deepEqual(r1.applied.map((a) => a.mode), ["applied"]);
  for (const t of MIGRATIONS[0].adopt.tables) assert.ok(await tableExists(db, t), t);
  assert.deepEqual((await runMigrations(db, MIGRATIONS)).applied, []);
  assert.deepEqual(await modes(db), ["1:applied"]);
});

test("base existente (Production): se ADOPTA sin ejecutar nada ni tocar datos", async () => {
  const db = memoryDb();
  // Estado legado: el esquema viejo + datos reales, sin schema_migrations.
  for (const sql of MIGRATIONS[0].statements) await db.query(sql);
  await db.query(`INSERT INTO studio_counters (year, last) VALUES (2026, 41)`);
  await db.query(
    `INSERT INTO studio_budgets (id, number, status, client_name, project_name, budget_date, currency, total, data)
     VALUES ('b1','2026-0041','sent','Cliente','Proyecto','2026-11-01','ARS',1500.50,'{"type":"video"}')`
  );
  await db.query(`INSERT INTO testimonials (id, brand, person, comment, status) VALUES ('t1','Marca','Ana','Genial','published')`);

  // Si el baseline se ejecutara, esto delataría cualquier DDL: lo registramos.
  const ddl = [];
  const spy = { ...db, query: async (sql, p) => (/CREATE|ALTER|DROP/i.test(sql) && !/schema_migrations/.test(sql) && ddl.push(sql), db.query(sql, p)),
    tx: (fn) => db.tx((t) => fn({ query: async (sql, p) => (/CREATE|ALTER|DROP/i.test(sql) && ddl.push(sql), t.query(sql, p)) })) };
  const r = await runMigrations(spy, MIGRATIONS);

  assert.deepEqual(r.applied.map((a) => a.mode), ["adopted"]);
  assert.deepEqual(ddl, [], "adoptar no debe ejecutar DDL sobre las tablas existentes");
  assert.deepEqual(await modes(db), ["1:adopted"]);
  assert.equal((await db.query(`SELECT last FROM studio_counters WHERE year = 2026`))[0].last, 41);
  assert.equal((await db.query(`SELECT total::float8 AS t FROM studio_budgets WHERE id='b1'`))[0].t, 1500.5);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM testimonials`))[0].n, 1);
});

test("base legada incompleta: 'repair' crea solo lo que falta, sin perder datos", async () => {
  const db = memoryDb();
  for (const sql of MIGRATIONS[0].statements) await db.query(sql);
  await db.query(`INSERT INTO studio_counters (year, last) VALUES (2025, 7)`);
  await db.query(`DROP TABLE rate_limits`);
  const r = await runMigrations(db, MIGRATIONS);
  assert.deepEqual(r.applied.map((a) => a.mode), ["repaired"]);
  assert.ok(await tableExists(db, "rate_limits"));
  assert.equal((await db.query(`SELECT last FROM studio_counters WHERE year = 2025`))[0].last, 7);
});

test("migraciones nuevas: aditivas, en orden, atómicas", async () => {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const v2 = { id: 2, name: "t2", statements: [`CREATE TABLE IF NOT EXISTS t2 (id INT PRIMARY KEY)`, `CREATE INDEX IF NOT EXISTS t2_i ON t2 (id)`] };
  assert.deepEqual((await runMigrations(db, [...MIGRATIONS, v2])).applied.map((a) => a.id), [2]);

  // Falla en la 2ª sentencia → rollback completo: no queda ni la tabla ni el registro.
  const bad = { id: 3, name: "bad", statements: [`CREATE TABLE t3 (id INT)`, `THIS IS NOT SQL`] };
  await assert.rejects(runMigrations(db, [...MIGRATIONS, v2, bad]));
  assert.equal(await tableExists(db, "t3"), false);
  assert.deepEqual(await modes(db), ["1:applied", "2:applied"]);

  // Orden inválido / duplicado se rechaza antes de tocar nada.
  await assert.rejects(runMigrations(db, [v2, MIGRATIONS[0]]), /fuera de orden/);
});

test("arranques concurrentes: una sola aplicación, sin errores", async () => {
  const db = memoryDb();
  const results = await Promise.all([1, 2, 3, 4].map(() => runMigrations(db, MIGRATIONS)));
  assert.equal(results.flatMap((r) => r.applied).length, 1);
  assert.deepEqual(await modes(db), ["1:applied"]);
});

test("db.tx: commit, rollback y aislamiento", async () => {
  const db = memoryDb();
  await db.query(`CREATE TABLE acc (id INT PRIMARY KEY, n INT)`);
  await db.tx(async (t) => { await t.query(`INSERT INTO acc VALUES (1, 10)`); await t.query(`INSERT INTO acc VALUES (2, 20)`); });
  assert.equal((await db.query(`SELECT count(*)::int n FROM acc`))[0].n, 2);
  await assert.rejects(db.tx(async (t) => { await t.query(`UPDATE acc SET n = 0`); throw new Error("boom"); }), /boom/);
  assert.deepEqual((await db.query(`SELECT n FROM acc ORDER BY id`)).map((r) => r.n), [10, 20]);
  const out = await db.tx(async (t) => (await t.query(`SELECT 7 AS x`))[0].x);
  assert.equal(out, 7);
});
