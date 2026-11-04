import "server-only";
import { MIGRATIONS } from "./migrations.js";
import { runMigrations } from "./migrate.js";

// Minimal Postgres access. Production/preview: DATABASE_URL (any Postgres:
// Neon, Supabase, Vercel Postgres...). Local dev without DATABASE_URL: an
// embedded Postgres (PGlite) persisted in ./.data/studio-db — same SQL.
//
// The schema is versioned in ./migrations.js and applied by ./migrate.js.
//
// API:  db.query(sql, params) → rows
//       db.tx(async (t) => { await t.query(...); ... })
//         One connection, BEGIN/COMMIT, automatic ROLLBACK if `fn` throws.
//         Use it whenever several writes must succeed or fail together.
//         Do NOT call db.query() inside fn (it would run outside the
//         transaction) and do not nest tx() calls.

const g = globalThis;

async function connect() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import("pg");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({
      connectionString: url,
      max: 3,
      ssl: local ? false : { rejectUnauthorized: false },
    });
    return {
      query: async (sql, params = []) => (await pool.query(sql, params)).rows,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({ query: async (sql, params = []) => (await client.query(sql, params)).rows });
          await client.query("COMMIT");
          return result;
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch {}
          throw err;
        } finally {
          client.release();
        }
      },
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL no está configurada (requerida en producción).");
  }
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite("./.data/studio-db");
  return {
    query: async (sql, params = []) => (await db.query(sql, params)).rows,
    tx: (fn) =>
      db.transaction((t) => fn({ query: async (sql, params = []) => (await t.query(sql, params)).rows })),
  };
}

export async function getDb() {
  if (!g.__studioDb) {
    g.__studioDb = (async () => {
      const db = await connect();
      await runMigrations(db, MIGRATIONS, (m) => console.log(m));
      return db;
    })();
    g.__studioDb.catch(() => (g.__studioDb = null));
  }
  return g.__studioDb;
}
