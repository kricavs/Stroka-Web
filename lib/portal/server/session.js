import "server-only";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/studio/server/db";
import { getPepper } from "../access-code.js";
import { resolveSessionCore } from "../auth-core.js";

export { generateToken, hashToken } from "../token.js";

// Must return { clientId, sessionId, displayName } only when the session
// exists, is not revoked/expired AND its client is active — otherwise null.
export async function resolveSession(tokenHash) {
  return resolveSessionCore(await getDb(), tokenHash);
}

// Hash of the caller's IP (peppered with PORTAL_SECRET, never STUDIO_*).
export function portalIpHash(req) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", getPepper()).update(`ip|${ip}`).digest("hex").slice(0, 32);
}
