import "server-only";
import { mintScope } from "@/lib/portal/scope-core.js";
import { hasSession } from "./auth";
import { getDb } from "./db";

// "VER COMO CLIENTE": an authenticated Studio admin renders the portal for a
// given client. The scope is `admin-preview` — read-only (see assertWritable)
// and never backed by a portal session or cookie. Returns null if the client
// doesn't exist.
export async function adminPreviewScope(clientId) {
  if (!(await hasSession())) throw new Error("Se requiere sesión de Studio.");
  const id = String(clientId);
  const db = await getDb();
  const [c] = await db.query(`SELECT display_name FROM clients WHERE id = $1`, [id]);
  if (!c) return null;
  return mintScope({ clientId: id, source: "admin-preview", displayName: c.display_name });
}
