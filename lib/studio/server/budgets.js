import "server-only";
import { randomUUID } from "node:crypto";
import { NUMBER_PREFIX } from "../config";
import { getDb } from "./db";

const SUMMARY = `id, number, status, client_name, project_name, budget_date::text AS budget_date,
  currency, total::float8 AS total, data->>'type' AS type, created_at, updated_at`;

const summary = (r) => ({
  id: r.id,
  number: r.number,
  status: r.status,
  clientName: r.client_name,
  projectName: r.project_name,
  date: r.budget_date,
  currency: r.currency,
  total: r.total,
  type: r.type,
  updatedAt: r.updated_at,
});

const full = (r) => ({
  ...r.data,
  id: r.id,
  number: r.number,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Atomic per-year counter: a single UPSERT, so concurrent saves never share a
// number. The UNIQUE constraint on `number` is a second safety net.
async function nextNumber(db, year) {
  const [row] = await db.query(
    `INSERT INTO studio_counters (year, last) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last = studio_counters.last + 1
     RETURNING last`,
    [year]
  );
  return `${NUMBER_PREFIX}-${year}-${String(row.last).padStart(3, "0")}`;
}

export async function listBudgets(search = "") {
  const db = await getDb();
  const q = search.trim();
  const rows = q
    ? await db.query(
        `SELECT ${SUMMARY} FROM studio_budgets
         WHERE client_name ILIKE $1 OR project_name ILIKE $1 OR number ILIKE $1
         ORDER BY created_at DESC LIMIT 500`,
        [`%${q.replace(/[%_\\]/g, "\\$&")}%`]
      )
    : await db.query(`SELECT ${SUMMARY} FROM studio_budgets ORDER BY created_at DESC LIMIT 500`);
  return rows.map(summary);
}

export async function getBudget(id) {
  const db = await getDb();
  const [r] = await db.query(`SELECT * FROM studio_budgets WHERE id = $1`, [String(id)]);
  return r ? full(r) : null;
}

export async function createBudget(data) {
  const db = await getDb();
  const year = Number(data.date.slice(0, 4));
  const id = randomUUID();
  const number = await nextNumber(db, year);
  const stored = { ...data };
  await db.query(
    `INSERT INTO studio_budgets (id, number, status, client_name, project_name, budget_date, currency, total, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, number, data.status, data.clientName, data.projectName, data.date, data.currency, data.total, JSON.stringify(stored)]
  );
  return getBudget(id);
}

export async function updateBudget(id, data) {
  const db = await getDb();
  const rows = await db.query(
    `UPDATE studio_budgets SET status=$2, client_name=$3, project_name=$4, budget_date=$5,
       currency=$6, total=$7, data=$8, updated_at=now()
     WHERE id=$1 RETURNING id`,
    [String(id), data.status, data.clientName, data.projectName, data.date, data.currency, data.total, JSON.stringify(data)]
  );
  return rows.length ? getBudget(id) : null;
}

export async function setStatus(id, status) {
  const db = await getDb();
  const rows = await db.query(
    `UPDATE studio_budgets SET status=$2, data = jsonb_set(data, '{status}', to_jsonb($2::text)), updated_at=now()
     WHERE id=$1 RETURNING id`,
    [String(id), status]
  );
  return rows.length > 0;
}

export async function duplicateBudget(id, today) {
  const src = await getBudget(id);
  if (!src) return null;
  const { id: _i, number: _n, createdAt: _c, updatedAt: _u, ...rest } = src;
  return createBudget({
    ...rest,
    date: today,
    status: "BORRADOR",
    projectName: rest.projectName,
  });
}

export async function deleteBudget(id) {
  const db = await getDb();
  const rows = await db.query(`DELETE FROM studio_budgets WHERE id=$1 RETURNING id`, [String(id)]);
  return rows.length > 0;
}

export async function exportAll() {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM studio_budgets ORDER BY created_at`);
  return rows.map(full);
}
