// MCP access tokens, db-injected (pg, PGlite, tests).
// Plaintext = "stk_mcp_" + 256 random bits (base64url). Only its sha256 is stored
// (fine for a high-entropy random secret; no slow KDF needed). The plaintext is
// returned by create/regenerate ONCE and can't be recovered afterwards.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { logActivity, newId } from "../portal/activity-core.js";
import { InputError } from "../studio/errors.js";
import { mintMcpScope } from "./scope-core.js";

export const TOKEN_PREFIX = "stk_mcp_";
export const generateMcpToken = () => TOKEN_PREFIX + randomBytes(32).toString("base64url");
export const hashMcpToken = (token) => createHash("sha256").update(String(token)).digest("hex");
const ACTOR = { actorType: "admin", actorName: "Stroka" };
const LAST_USED_GRANULARITY_MS = 60_000;

export function cleanLabel(input) {
  const s = String(input ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  if (s.length < 1 || s.length > 80) throw new InputError("Ingresá un nombre (hasta 80 caracteres).");
  return s;
}

async function insertToken(t, clientId, label, canWrite) {
  const token = generateMcpToken();
  const id = newId("mcp");
  await t.query(
    `INSERT INTO mcp_access_tokens (id, client_id, label, token_hash, can_write) VALUES ($1,$2,$3,$4,$5)`,
    [id, clientId, label, hashMcpToken(token), canWrite]
  );
  return { id, token };
}

export async function createMcpToken(db, clientId, { label, canWrite = true }) {
  const name = cleanLabel(label);
  return db.tx(async (t) => {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    const { id, token } = await insertToken(t, clientId, name, canWrite === true);
    await logActivity(t, { clientId, ...ACTOR, event: "mcp.token_created", data: { tokenId: id, label: name, canWrite: canWrite === true } });
    return { id, token, label: name, canWrite: canWrite === true };
  });
}

export async function revokeMcpToken(db, clientId, tokenId) {
  return db.tx(async (t) => {
    const [r] = await t.query(
      `UPDATE mcp_access_tokens SET active = false, revoked_at = now()
        WHERE id = $1 AND client_id = $2 AND active RETURNING label`,
      [tokenId, clientId]
    );
    if (!r) throw new InputError("Acceso no encontrado o ya revocado.", 404);
    await logActivity(t, { clientId, ...ACTOR, event: "mcp.token_revoked", data: { tokenId, label: r.label } });
    return { id: tokenId };
  });
}

// Revokes the old credential and issues a new one (same label & permission) atomically.
export async function regenerateMcpToken(db, clientId, tokenId) {
  return db.tx(async (t) => {
    const [old] = await t.query(
      `UPDATE mcp_access_tokens SET active = false, revoked_at = now()
        WHERE id = $1 AND client_id = $2 AND active RETURNING label, can_write`,
      [tokenId, clientId]
    );
    if (!old) throw new InputError("Acceso no encontrado o ya revocado.", 404);
    const { id, token } = await insertToken(t, clientId, old.label, old.can_write);
    await logActivity(t, { clientId, ...ACTOR, event: "mcp.token_regenerated", data: { oldTokenId: tokenId, tokenId: id, label: old.label } });
    return { id, token, label: old.label, canWrite: old.can_write };
  });
}

// Never returns hashes.
export async function listMcpTokens(db, clientId) {
  const rows = await db.query(
    `SELECT id, label, active, can_write, created_at, last_used_at, revoked_at
       FROM mcp_access_tokens WHERE client_id = $1 ORDER BY active DESC, created_at DESC LIMIT 100`,
    [clientId]
  );
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  return rows.map((r) => ({
    id: r.id, label: r.label, active: r.active, canWrite: r.can_write,
    createdAt: iso(r.created_at), lastUsedAt: iso(r.last_used_at), revokedAt: iso(r.revoked_at),
  }));
}

// Resolves a bearer header to a scope. Returns { ok: true, scope } or
// { ok: false, code: "AUTH_REQUIRED" | "TOKEN_REVOKED" }. Invalid, malformed and
// inactive-client tokens are all AUTH_REQUIRED so nothing about their existence leaks.
export async function authenticateMcpToken(db, authorizationHeader, now = new Date()) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(String(authorizationHeader ?? ""));
  if (!m || !m[1].startsWith(TOKEN_PREFIX) || m[1].length > 200) return { ok: false, code: "AUTH_REQUIRED" };
  const hash = hashMcpToken(m[1]);
  const [row] = await db.query(
    `SELECT k.id, k.client_id, k.label, k.can_write, k.active, k.token_hash, k.last_used_at, c.active AS client_active
       FROM mcp_access_tokens k JOIN clients c ON c.id = k.client_id WHERE k.token_hash = $1`,
    [hash]
  );
  if (!row) return { ok: false, code: "AUTH_REQUIRED" };
  const a = Buffer.from(row.token_hash), b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: "AUTH_REQUIRED" };
  if (!row.active) return { ok: false, code: "TOKEN_REVOKED" };
  if (!row.client_active) return { ok: false, code: "AUTH_REQUIRED" };
  if (!row.last_used_at || now - new Date(row.last_used_at) > LAST_USED_GRANULARITY_MS) {
    await db.query(`UPDATE mcp_access_tokens SET last_used_at = $2 WHERE id = $1`, [row.id, now]);
  }
  return { ok: true, scope: mintMcpScope({ clientId: row.client_id, tokenId: row.id, label: row.label, canWrite: row.can_write }) };
}
