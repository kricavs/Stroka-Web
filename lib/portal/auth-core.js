// Portal authentication, db-injected (pg, PGlite, tests).
//
// Login never says WHY it failed: unknown company, wrong code, inactive
// client, locked client and blocked IP+client all return the same
// `{ ok:false, reason:"invalid" }`, and every path burns exactly one scrypt
// (a dummy hash when there is nothing real to check) so timing is uniform.
// Only the per-IP request budget answers differently ("throttled"), and it
// doesn't depend on the company typed.
import { dummyHash, getPepper, normalizeCode, verifyAccessCode } from "./access-code.js";
import { logActivity, newId } from "./activity-core.js";
import { generateToken, hashToken } from "./token.js";
import { loginKey } from "../shared/slug.js";
import { PORTAL_MAX_AGE } from "./cookie.js";

export const WINDOW_SEC = 15 * 60;
export const IP_LIMIT = 10; // login attempts per IP per window
export const PAIR_FAILS = 5; // failures per IP+client per window
export const CLIENT_FAILS = 10; // consecutive failures (any IP) before the client locks
export const LOCK_STEPS_MIN = [15, 60, 240, 1440]; // escalating client lockouts
export const SESSION_TOUCH_MIN = 5;

const bucketKey = (key, now) => `${key}:${Math.floor(now.getTime() / 1000 / WINDOW_SEC)}`;

async function hit(db, key, limit, now) {
  const [r] = await db.query(
    `INSERT INTO rate_limits (key, count) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`,
    [bucketKey(key, now)]
  );
  return r.count <= limit;
}
async function peek(db, key, now) {
  const [r] = await db.query(`SELECT count FROM rate_limits WHERE key = $1`, [bucketKey(key, now)]);
  return r ? r.count : 0;
}

export async function attemptLogin(db, { company, code, ipHash, userAgent = null, now = new Date(), pepper }) {
  pepper ??= getPepper();
  if (!(await hit(db, `plogin-ip:${ipHash}`, IP_LIMIT, now))) return { ok: false, reason: "throttled" };

  const key = loginKey(company);
  const canonical = normalizeCode(code);
  const [client] = key
    ? await db.query(
        `SELECT id, display_name, active, code_hash, locked_until, lockouts FROM clients WHERE login_key = $1`,
        [key]
      )
    : [];
  const pairKey = client ? `plogin-fail:${client.id}:${ipHash}` : null;
  const locked = Boolean(client?.locked_until && new Date(client.locked_until) > now);
  const pairBlocked = client ? (await peek(db, pairKey, now)) >= PAIR_FAILS : false;
  const usable = Boolean(client && client.active && client.code_hash && !locked && !pairBlocked);

  const match = await verifyAccessCode(canonical, usable ? client.code_hash : await dummyHash(pepper), pepper);

  if (!(usable && match)) {
    if (usable) {
      await hit(db, pairKey, Infinity, now);
      const mins = LOCK_STEPS_MIN[Math.min(client.lockouts, LOCK_STEPS_MIN.length - 1)];
      await db.query(
        `UPDATE clients SET
           failed_attempts = CASE WHEN failed_attempts + 1 >= $2 THEN 0 ELSE failed_attempts + 1 END,
           locked_until    = CASE WHEN failed_attempts + 1 >= $2 THEN $3::timestamptz ELSE locked_until END,
           lockouts        = CASE WHEN failed_attempts + 1 >= $2 THEN lockouts + 1 ELSE lockouts END
         WHERE id = $1`,
        [client.id, CLIENT_FAILS, new Date(now.getTime() + mins * 60000)]
      );
    }
    return { ok: false, reason: "invalid" };
  }

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + PORTAL_MAX_AGE * 1000);
  await db.tx(async (t) => {
    await t.query(
      `INSERT INTO client_sessions (id, client_id, token_hash, display_name, created_at, last_seen_at, expires_at, ip_hash, user_agent)
       VALUES ($1,$2,$3,NULL,$4,$4,$5,$6,$7)`,
      // display_name stays NULL: it is the person's declared name, asked on first action (Fase 2).
      [newId("ses"), client.id, hashToken(token), now, expiresAt, ipHash, (userAgent || "").slice(0, 300)]
    );
    await t.query(
      `UPDATE clients SET failed_attempts = 0, lockouts = 0, locked_until = NULL, last_login_at = $2 WHERE id = $1`,
      [client.id, now]
    );
    await logActivity(t, { clientId: client.id, actorType: "client", actorName: client.display_name, event: "login.success" });
  });
  return { ok: true, token, clientId: client.id, expiresAt };
}

// The ONE place a portal request turns into a client id. Valid only if the
// session exists, isn't revoked/expired AND its client is active.
export async function resolveSessionCore(db, tokenHash, now = new Date()) {
  const [s] = await db.query(
    `SELECT s.id, s.client_id, s.display_name, s.last_seen_at
       FROM client_sessions s JOIN clients c ON c.id = s.client_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND c.active = true`,
    [tokenHash, now]
  );
  if (!s) return null;
  if (now - new Date(s.last_seen_at) > SESSION_TOUCH_MIN * 60000) {
    await db.query(`UPDATE client_sessions SET last_seen_at = $2 WHERE id = $1`, [s.id, now]);
  }
  return { clientId: s.client_id, sessionId: s.id, displayName: s.display_name };
}

export async function revokeSessionByToken(db, tokenHash, now = new Date()) {
  await db.query(`UPDATE client_sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash, now]);
}

export async function revokeAllSessions(q, clientId, now = new Date()) {
  const rows = await q.query(
    `UPDATE client_sessions SET revoked_at = $2 WHERE client_id = $1 AND revoked_at IS NULL RETURNING id`,
    [clientId, now]
  );
  return rows.length;
}
