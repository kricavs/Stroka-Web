// Studio-side client management, db-injected (pg, PGlite, tests).
import { generateAccessCode, getPepper, hashAccessCode } from "../portal/access-code.js";
import { logActivity, newId } from "../portal/activity-core.js";
import { revokeAllSessions } from "../portal/auth-core.js";
import { loginKey, slugify } from "../shared/slug.js";
import { InputError } from "./errors.js";

const ACTOR = { actorType: "admin", actorName: "Stroka" };
const HEX = /^#[0-9a-fA-F]{6}$/;

export function parseClientInput(b, { partial = false } = {}) {
  const out = {};
  const str = (k, max) => {
    if (b[k] === undefined) return partial ? undefined : "";
    return String(b[k] ?? "").trim().slice(0, max);
  };
  const name = str("name", 120);
  if (name !== undefined) {
    if (!name || !loginKey(name)) throw new InputError("Ingresá el nombre de la empresa.");
    out.name = name;
  }
  const display = str("displayName", 120);
  if (display !== undefined) out.displayName = display;
  const accent = str("accent", 7);
  if (accent !== undefined) {
    if (accent && !HEX.test(accent)) throw new InputError("El color debe tener formato #RRGGBB.");
    out.accent = accent || null;
  }
  const notes = str("notes", 4000);
  if (notes !== undefined) out.notes = notes || null;
  if (b.monthly !== undefined) {
    const n = Number(b.monthly);
    if (!Number.isInteger(n) || n < 0 || n > 500) throw new InputError("La cantidad mensual debe ser un entero entre 0 y 500.");
    out.monthly = n;
  } else if (!partial) out.monthly = 0;
  return out;
}

async function uniqueSlug(q, base) {
  const root = base || "cliente";
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const rows = await q.query(`SELECT 1 FROM clients WHERE slug = $1`, [slug]);
    if (!rows.length) return slug;
  }
  return `${root}-${newId("x").slice(2)}`;
}

async function assertNameFree(q, key, exceptId = null) {
  const rows = await q.query(`SELECT id FROM clients WHERE login_key = $1`, [key]);
  if (rows.length && rows[0].id !== exceptId) throw new InputError("Ya existe un cliente con ese nombre de empresa.", 409);
}

export async function createClient(db, input) {
  const v = parseClientInput(input);
  const key = loginKey(v.name);
  const id = newId("cli");
  await db.tx(async (t) => {
    await assertNameFree(t, key);
    const slug = await uniqueSlug(t, slugify(v.name));
    await t.query(
      `INSERT INTO clients (id, name, display_name, slug, login_key, accent, notes, settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [id, v.name, v.displayName || v.name, slug, key, v.accent, v.notes, JSON.stringify({ defaultMonthly: v.monthly })]
    );
    await logActivity(t, { clientId: id, ...ACTOR, event: "client.created" });
  });
  return id;
}

export async function updateClient(db, id, input) {
  const v = parseClientInput(input, { partial: true });
  await db.tx(async (t) => {
    const [cur] = await t.query(`SELECT id FROM clients WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur) throw new InputError("Cliente no encontrado.", 404);
    if (v.name !== undefined) await assertNameFree(t, loginKey(v.name), id);
    await t.query(
      `UPDATE clients SET
         name = COALESCE($2, name), login_key = COALESCE($3, login_key),
         display_name = COALESCE($4, display_name),
         accent = CASE WHEN $5::boolean THEN $6 ELSE accent END,
         notes  = CASE WHEN $7::boolean THEN $8 ELSE notes END,
         settings = CASE WHEN $9::int IS NULL THEN settings
                         ELSE jsonb_set(settings, '{defaultMonthly}', to_jsonb($9::int)) END,
         updated_at = now()
       WHERE id = $1`,
      [
        id,
        v.name ?? null,
        v.name !== undefined ? loginKey(v.name) : null,
        v.displayName || null,
        v.accent !== undefined,
        v.accent ?? null,
        v.notes !== undefined,
        v.notes ?? null,
        v.monthly ?? null,
      ]
    );
    await logActivity(t, { clientId: id, ...ACTOR, event: "client.updated", data: { fields: Object.keys(v) } });
  });
}

export async function setActive(db, id, active) {
  await db.tx(async (t) => {
    const rows = await t.query(`UPDATE clients SET active = $2, updated_at = now() WHERE id = $1 AND active <> $2 RETURNING id`, [id, Boolean(active)]);
    if (!rows.length) {
      const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [id]);
      if (!c) throw new InputError("Cliente no encontrado.", 404);
      return; // already in that state
    }
    await logActivity(t, { clientId: id, ...ACTOR, event: active ? "client.activated" : "client.deactivated" });
  });
}

// Returns the plaintext code ONCE; only its scrypt hash is stored.
export async function generateAccess(db, id, { revokeSessions = true, origin = "https://strokavisual.com", pepper } = {}) {
  pepper ??= getPepper();
  const code = generateAccessCode();
  const codeHash = await hashAccessCode(code.replace(/-/g, "").slice(3), pepper);
  const out = await db.tx(async (t) => {
    const [c] = await t.query(`SELECT name, code_hash FROM clients WHERE id = $1 FOR UPDATE`, [id]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    const regenerate = Boolean(c.code_hash);
    await t.query(
      `UPDATE clients SET code_hash = $2, code_generated_at = now(), failed_attempts = 0, lockouts = 0,
                          locked_until = NULL, updated_at = now() WHERE id = $1`,
      [id, codeHash]
    );
    const revoked = regenerate && revokeSessions ? await revokeAllSessions(t, id) : 0;
    await logActivity(t, {
      clientId: id,
      ...ACTOR,
      event: regenerate ? "access.regenerated" : "access.generated",
      data: regenerate ? { sessionsRevoked: revokeSessions, count: revoked } : {},
    });
    return { name: c.name, regenerated: regenerate, sessionsRevoked: revoked };
  });
  return { ...out, code, url: `${origin}/portal` };
}

// Clears a login lockout. Does NOT touch the code or the sessions.
export async function unlockAccess(db, id) {
  await db.tx(async (t) => {
    const rows = await t.query(
      `UPDATE clients SET locked_until = NULL, failed_attempts = 0, lockouts = 0, updated_at = now() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) throw new InputError("Cliente no encontrado.", 404);
    // also lift the per-IP+client throttle (rate_limits keys: plogin-fail:<client>:<ip>:<bucket>)
    await t.query(`DELETE FROM rate_limits WHERE key LIKE $1`, [`plogin-fail:${id}:%`]);
    await logActivity(t, { clientId: id, ...ACTOR, event: "client.access_unlocked" });
  });
}

export async function revokeSessions(db, id) {
  return db.tx(async (t) => {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [id]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    const n = await revokeAllSessions(t, id);
    await logActivity(t, { clientId: id, ...ACTOR, event: "sessions.revoked", data: { count: n } });
    return n;
  });
}

export async function setMonthGoal(db, id, month, contracted) {
  const n = Number(contracted);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)) || !Number.isInteger(n) || n < 0 || n > 500) {
    throw new InputError("Mes o cantidad inválidos.");
  }
  await db.tx(async (t) => {
    const [c] = await t.query(`SELECT 1 FROM clients WHERE id = $1`, [id]);
    if (!c) throw new InputError("Cliente no encontrado.", 404);
    await t.query(
      `INSERT INTO client_month_goals (client_id, month, contracted) VALUES ($1,$2,$3)
       ON CONFLICT (client_id, month) DO UPDATE SET contracted = EXCLUDED.contracted`,
      [id, month, n]
    );
    await logActivity(t, { clientId: id, ...ACTOR, event: "goal.set", data: { month, contracted: n } });
  });
}

// Never returns code_hash.
export async function getClient(db, id) {
  const [c] = await db.query(
    `SELECT c.id, c.name, c.display_name, c.slug, c.active, c.accent, c.notes, c.settings,
            (c.code_hash IS NOT NULL) AS has_code, c.code_generated_at, c.last_login_at, c.locked_until,
            c.created_at,
            (SELECT count(*) FROM client_sessions s
               WHERE s.client_id = c.id AND s.revoked_at IS NULL AND s.expires_at > now())::int AS active_sessions
       FROM clients c WHERE c.id = $1`,
    [id]
  );
  return c || null;
}

export async function listClients(db, { month, monthStart, monthEnd, now = new Date() }) {
  return db.query(
    `SELECT c.id, c.name, c.display_name, c.active, c.accent, c.last_login_at, (c.code_hash IS NOT NULL) AS has_code,
            COALESCE(g.contracted, (c.settings->>'defaultMonthly')::int, 0) AS contracted,
            (SELECT count(*) FROM content_items i WHERE i.client_id = c.id AND i.status <> 'cancelled'
                AND i.scheduled_at >= $2 AND i.scheduled_at < $3)::int AS month_count,
            (SELECT count(*) FROM content_items i WHERE i.client_id = c.id AND i.status = 'published'
                AND i.scheduled_at >= $2 AND i.scheduled_at < $3)::int AS month_published,
            (SELECT count(*) FROM content_items i WHERE i.client_id = c.id AND i.status = 'client_review')::int AS pending,
            (SELECT min(i.scheduled_at) FROM content_items i WHERE i.client_id = c.id
                AND i.status NOT IN ('idea','cancelled','published') AND i.scheduled_at >= $4) AS next_at
       FROM clients c LEFT JOIN client_month_goals g ON g.client_id = c.id AND g.month = $1
      ORDER BY c.active DESC, lower(c.name)`,
    [month, monthStart, monthEnd, now]
  );
}

export async function listActivity(db, clientId, limit = 100) {
  return db.query(
    `SELECT a.seq, a.content_id, a.actor_type, a.actor_name, a.event, a.data, a.created_at, i.title AS content_title
       FROM activity_log a LEFT JOIN content_items i ON i.id = a.content_id AND i.client_id = a.client_id
      WHERE a.client_id = $1 ORDER BY a.seq DESC LIMIT $2`,
    [clientId, limit]
  );
}

export async function clientOptions(db) {
  return db.query(`SELECT id, name, active FROM clients ORDER BY active DESC, lower(name)`);
}
