import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export const STATUSES = ["pending", "published", "hidden", "rejected"];

const row = (r) => ({
  id: r.id,
  brand: r.brand,
  person: r.person,
  comment: r.comment,
  status: r.status,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

export async function createTestimonial({ brand, person, comment }, ipHash) {
  const db = await getDb();
  await db.query(
    `INSERT INTO testimonials (id, brand, person, comment, status, ip_hash)
     VALUES ($1,$2,$3,$4,'pending',$5)`,
    [randomUUID(), brand, person, comment, ipHash]
  );
}

// Studio: pending first, then published (manual order), hidden, rejected.
export async function listTestimonials() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM testimonials
     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,
              CASE WHEN status = 'published' THEN sort_order END ASC,
              created_at DESC
     LIMIT 500`
  );
  return rows.map(row);
}

export async function countPending() {
  const db = await getDb();
  const [r] = await db.query(`SELECT count(*)::int AS n FROM testimonials WHERE status = 'pending'`);
  return r.n;
}

// Public: the only query that feeds the website. Published only.
export async function getPublishedTestimonials() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT brand, person, comment, id FROM testimonials
     WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC LIMIT 50`
  );
  return rows.map((r) => ({ id: r.id, brand: r.brand, person: r.person, comment: r.comment }));
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) return false;
  const db = await getDb();
  // Newly published entries go to the end of the manual order.
  const rows = await db.query(
    `UPDATE testimonials SET status = $2, moderated_at = now(),
       sort_order = CASE WHEN $2 = 'published' AND status <> 'published'
         THEN COALESCE((SELECT max(sort_order) + 1 FROM testimonials WHERE status = 'published'), 0)
         ELSE sort_order END
     WHERE id = $1 RETURNING id`,
    [String(id), status]
  );
  return rows.length > 0;
}

export async function deleteTestimonial(id) {
  const db = await getDb();
  return (await db.query(`DELETE FROM testimonials WHERE id = $1 RETURNING id`, [String(id)])).length > 0;
}

// `ids` = published ids in the desired order.
export async function reorderPublished(ids) {
  const db = await getDb();
  for (const [i, id] of ids.entries()) {
    await db.query(`UPDATE testimonials SET sort_order = $2 WHERE id = $1 AND status = 'published'`, [String(id), i]);
  }
}
