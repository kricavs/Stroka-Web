import { PGlite } from "@electric-sql/pglite";

// Same adapter shape as lib/studio/server/db.js (PGlite branch), in memory.
export function memoryDb() {
  const db = new PGlite();
  return {
    raw: db,
    query: async (sql, params = []) => (await db.query(sql, params)).rows,
    tx: (fn) => db.transaction((t) => fn({ query: async (sql, params = []) => (await t.query(sql, params)).rows })),
  };
}
