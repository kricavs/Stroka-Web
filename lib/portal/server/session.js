import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Opaque session tokens. The cookie holds a random 256-bit token; the DB (Fase
// 1, table client_sessions) holds only its sha256, so a database leak can't be
// replayed as sessions. Revocable server-side, unlike the Studio's stateless
// cookie.

export const generateToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");

// Fase 1 connects this to client_sessions: must return
//   { clientId, sessionId, displayName } only when the session exists, is not
//   revoked/expired AND its client is active — otherwise null.
// Fase 0 has no clients/sessions yet, so nothing can be authenticated.
export async function resolveSession(tokenHash) {
  void tokenHash;
  return null;
}
