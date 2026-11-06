// DEV ONLY. Seeds fake clients ("Demo …") so the Studio dashboard can be seen
// with every scenario. Refuses to run unless DATABASE_URL points at localhost,
// and never runs twice on the same database. Nothing here is real data.
//
//   DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres node scripts/seed-dev-operations.mjs
import pg from "pg";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import { seedOperations } from "./operations-seed-data.mjs";

const url = process.env.DATABASE_URL || "";
if (process.env.NODE_ENV === "production" || !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Seed de desarrollo: solo contra una base LOCAL (DATABASE_URL en localhost). Abortado.");
  process.exit(2);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
const db = {
  query: async (sql, params = []) => (await client.query(sql, params)).rows,
  tx: async (fn) => {
    await client.query("BEGIN");
    try { const r = await fn({ query: async (sql, params = []) => (await client.query(sql, params)).rows }); await client.query("COMMIT"); return r; }
    catch (e) { await client.query("ROLLBACK"); throw e; }
  },
};
await runMigrations(db, MIGRATIONS);
if ((await db.query(`SELECT 1 FROM clients WHERE name LIKE 'Demo %'`)).length) {
  console.error("Ya hay clientes Demo en esta base. Usá una base nueva.");
  process.exit(2);
}

await seedOperations(db);
console.log("Seed de desarrollo listo: Demo Aurora, Brisa, Cobalto, Delta, Eco, Inactivo.");
await client.end();
