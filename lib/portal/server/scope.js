import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE } from "../cookie.js";
import { mintScope } from "../scope-core.js";
import { hashToken, resolveSession } from "./session.js";

// Resolve the client from the portal cookie on every request (no trust in
// URL/body). Returns a ClientScope or null.
export async function getClientScope() {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (!token || typeof token !== "string" || token.length > 256) return null;
  const s = await resolveSession(hashToken(token));
  if (!s) return null;
  return mintScope({ clientId: s.clientId, source: "session", sessionId: s.sessionId, displayName: s.displayName });
}

// Pages / layouts / server components.
export async function requireClient() {
  const scope = await getClientScope();
  if (!scope) redirect("/portal");
  return scope;
}

// Route handlers: `const { scope, denied } = await requireClientApi(); if (denied) return denied;`
export async function requireClientApi() {
  const scope = await getClientScope();
  if (!scope) return { scope: null, denied: Response.json({ error: "No autorizado" }, { status: 401 }) };
  return { scope, denied: null };
}
