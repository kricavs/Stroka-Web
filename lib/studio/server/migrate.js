// Migration runner. Pure: takes any `db` exposing `query(sql, params)` and
// `tx(fn)`, so it runs the same on pg (Neon), PGlite, and in tests.
//
// Safety properties:
//  - Fast path (nothing pending) = 2 cheap read-only queries, no lock, no DDL.
//  - Everything that writes (INCLUDING creating schema_migrations itself) runs
//    in ONE transaction, after pg_advisory_xact_lock (transaction-scoped: safe
//    behind PgBouncer/Neon pooler, unlike session locks). Concurrent cold
//    starts serialise; the losers re-read and no-op.
//    NB: CREATE TABLE IF NOT EXISTS is NOT safe under concurrency in Postgres
//    (racing sessions fail with "duplicate key ... pg_type_typname_nsp_index"),
//    so it must never run outside the lock.
//  - Any failure rolls the whole transaction back: no half-applied migration.
//  - The baseline is ADOPTED (not executed) when the legacy schema is already
//    complete, so Production data/tables are never touched.

export const MIGRATION_LOCK_KEY = 7391001;

const TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id         INT PRIMARY KEY,
  name       TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

function validate(migrations) {
  let prev = 0;
  for (const m of migrations) {
    if (!Number.isInteger(m.id) || m.id <= prev) throw new Error(`Migraciones fuera de orden en id ${m.id}`);
    if (!Array.isArray(m.statements) || !m.statements.length) throw new Error(`Migración ${m.id} sin sentencias`);
    prev = m.id;
  }
}

async function appliedIds(q) {
  return new Set((await q.query(`SELECT id FROM schema_migrations`)).map((r) => r.id));
}

// 'adopt' (everything exists) | 'repair' (some exists: run idempotent
// statements to fill gaps) | 'apply' (fresh database).
async function inspectLegacy(q, adopt) {
  if (!adopt) return "apply";
  let present = 0;
  for (const t of adopt.tables) {
    const [r] = await q.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [t]);
    if (r.ok) present++;
  }
  let idx = 0;
  for (const i of adopt.indexes || []) {
    const rows = await q.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1`, [i]);
    if (rows.length) idx++;
  }
  const total = adopt.tables.length + (adopt.indexes || []).length;
  if (present + idx === total) return "adopt";
  if (present + idx === 0) return "apply";
  return "repair";
}

async function nothingPending(db, migrations) {
  const [r] = await db.query(`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS ok`);
  if (!r.ok) return false;
  const done = await appliedIds(db);
  return migrations.every((m) => done.has(m.id));
}

export async function runMigrations(db, migrations, log = () => {}) {
  validate(migrations);
  if (await nothingPending(db, migrations)) return { applied: [] };

  const applied = [];
  await db.tx(async (t) => {
    await t.query(`SELECT pg_advisory_xact_lock($1)`, [MIGRATION_LOCK_KEY]);
    await t.query(TABLE); // serialised by the lock above
    const already = await appliedIds(t); // re-read: another instance may have won
    for (const m of migrations) {
      if (already.has(m.id)) continue;
      const verdict = await inspectLegacy(t, m.adopt);
      if (verdict !== "adopt") for (const sql of m.statements) await t.query(sql);
      const mode = verdict === "adopt" ? "adopted" : verdict === "repair" ? "repaired" : "applied";
      await t.query(`INSERT INTO schema_migrations (id, name, mode) VALUES ($1,$2,$3)`, [m.id, m.name, mode]);
      applied.push({ id: m.id, name: m.name, mode });
      log(`[db] migración ${m.id} (${m.name}): ${mode}`);
    }
  });
  return { applied };
}
