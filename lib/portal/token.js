import { createHash, randomBytes } from "node:crypto";

// Opaque session tokens: the cookie holds 256 random bits; the DB holds only
// the sha256, so a database leak can't be replayed as sessions.
export const generateToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
