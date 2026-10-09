import "server-only";

// Minimal Postgres access. Production/preview: DATABASE_URL (any Postgres:
// Neon, Supabase, Vercel Postgres...). Local dev without DATABASE_URL: an
// embedded Postgres (PGlite) persisted in ./.data/studio-db — same SQL.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS studio_budgets (
  id           TEXT PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  project_name TEXT NOT NULL,
  budget_date  DATE NOT NULL,
  currency     TEXT NOT NULL,
  total        NUMERIC(18,2) NOT NULL DEFAULT 0,
  data         JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS studio_counters (
  year INT PRIMARY KEY,
  last INT NOT NULL
);
`;

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
    return { query: async (sql, params = []) => (await pool.query(sql, params)).rows };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL no está configurada (requerida en producción).");
  }
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite("./.data/studio-db");
  return { query: async (sql, params = []) => (await db.query(sql, params)).rows };
}

export async function getDb() {
  if (!g.__studioDb) {
    g.__studioDb = (async () => {
      const db = await connect();
      for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.query(stmt);
      }
      return db;
    })();
    g.__studioDb.catch(() => (g.__studioDb = null));
  }
  return g.__studioDb;
}
