import "server-only";
import { getDb } from "@/lib/studio/server/db";
import { assertScope, scopedRunner } from "../scope-core.js";

// The only DB entry point for portal repositories.
//   const rows = await scopedQuery(scope, "SELECT … FROM content_items WHERE client_id = $1 AND id = $2", [id]);
// $1 is injected from the scope; pass the remaining params starting at $2.

export async function scopedQuery(scope, sql, params = [], opts) {
  assertScope(scope);
  const db = await getDb();
  return scopedRunner(db.query, scope)(sql, params, opts);
}

// Several statements atomically, same guard on each:
//   await scopedTx(scope, async (q) => { await q("UPDATE … WHERE client_id = $1 …", [..]); … });
export async function scopedTx(scope, fn) {
  assertScope(scope);
  const db = await getDb();
  return db.tx((t) => fn(scopedRunner(t.query, scope)));
}
