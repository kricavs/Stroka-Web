import { randomUUID } from "node:crypto";

// Append-only activity log. `q` is any `{ query }` (the db or a tx), so the
// entry commits or rolls back together with the change it describes.
// NEVER put codes, tokens or secrets in `data`.
export async function logActivity(q, { clientId, contentId = null, actorType, actorName = null, event, data = {}, clientVisible = false }) {
  await q.query(
    `INSERT INTO activity_log (client_id, content_id, actor_type, actor_name, event, data, client_visible)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [clientId, contentId, actorType, actorName, event, JSON.stringify(data), clientVisible]
  );
}

export const newId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
