import test from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as content from "../lib/studio/content-core.js";
import { attemptLogin, resolveSessionCore, revokeAllSessions, CLIENT_FAILS, IP_LIMIT, PAIR_FAILS } from "../lib/portal/auth-core.js";
import { hashToken } from "../lib/portal/token.js";
import { normalizeCode, CODE_ALPHABET, generateAccessCode, hashAccessCode, verifyAccessCode } from "../lib/portal/access-code.js";
import { contentRepo } from "../lib/portal/content-core.js";
import { mintScope, assertScope, scopedRunner } from "../lib/portal/scope-core.js";

const PEPPER = "p".repeat(40);
process.env.PORTAL_SECRET = PEPPER;

async function setup() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  return db;
}
const IP = "ip-aaaa";
const login = (db, company, code, extra = {}) => attemptLogin(db, { company, code, ipHash: IP, pepper: PEPPER, ...extra });

async function seedClient(db, name = "Laboratorio Millet") {
  const id = await clients.createClient(db, { name, displayName: "Millet", monthly: 12 });
  const a = await clients.generateAccess(db, id, { pepper: PEPPER });
  return { id, code: a.code, name };
}

// scopedQuery equivalent for tests
const sq = (db) => (scope, sql, params = [], opts) => {
  assertScope(scope);
  return scopedRunner(db.query, scope)(sql, params, opts);
};
const sessionScope = (id) => mintScope({ clientId: id, source: "session" });

test("migración 2: tablas, FK compuesta y reaplicación idempotente", async () => {
  const db = await setup();
  const t = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  const names = t.map((r) => r.table_name);
  for (const n of ["clients", "client_sessions", "client_month_goals", "content_items", "activity_log"]) assert.ok(names.includes(n), n);
  assert.deepEqual((await runMigrations(db, MIGRATIONS)).applied, []);
  const ids = (await db.query(`SELECT id FROM schema_migrations ORDER BY id`)).map((r) => r.id);
  assert.deepEqual(ids, MIGRATIONS.map((m) => m.id));
  // composite FK: activity cannot point at another client's content
  const a = await clients.createClient(db, { name: "A" });
  const b = await clients.createClient(db, { name: "B" });
  const cid = await content.createContent(db, a, { title: "x", platform: "instagram", contentType: "reel" });
  await assert.rejects(
    db.query(`INSERT INTO activity_log (client_id, content_id, actor_type, event) VALUES ($1,$2,'admin','x')`, [b, cid])
  );
});

test("códigos: formato, alfabeto, hash no reversible, pepper", async () => {
  for (let i = 0; i < 50; i++) {
    const c = generateAccessCode();
    assert.match(c, /^STK-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    for (const ch of c.slice(4).replace("-", "")) assert.ok(CODE_ALPHABET.includes(ch));
  }
  assert.ok(!/[01OIL]/.test(CODE_ALPHABET));
  assert.equal(normalizeCode("stk-abcde-fghjk"), "ABCDEFGHJK");
  assert.equal(normalizeCode("ABCDEFGHJK"), "ABCDEFGHJK");
  assert.equal(normalizeCode("STK-ABCDE-FGHJ0"), null);
  assert.equal(normalizeCode("corto"), null);
  const h = await hashAccessCode("ABCDEFGHJK", PEPPER);
  assert.ok(!h.includes("ABCDEFGHJK"));
  assert.ok(await verifyAccessCode("ABCDEFGHJK", h, PEPPER));
  assert.ok(!(await verifyAccessCode("ABCDEFGHJM", h, PEPPER)));
  assert.ok(!(await verifyAccessCode("ABCDEFGHJK", h, "q".repeat(40))), "otro pepper no verifica");
  assert.ok(!(await verifyAccessCode(null, h, PEPPER)));
  assert.notEqual(h, await hashAccessCode("ABCDEFGHJK", PEPPER), "salt distinto por hash");
});

test("generar acceso: no guarda el código; regenerar invalida el anterior", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  const dump = JSON.stringify(await db.query(`SELECT * FROM clients`)) + JSON.stringify(await db.query(`SELECT * FROM activity_log`));
  assert.ok(!dump.includes(code.slice(4, 9)), "el código no aparece en DB ni en activity");
  assert.ok((await login(db, "Laboratorio Millet", code, { now: new Date() })).ok);
  const r = await clients.generateAccess(db, id, { revokeSessions: false, pepper: PEPPER });
  assert.equal(r.regenerated, true);
  assert.equal((await login(db, "Laboratorio Millet", code)).ok, false, "código viejo inválido");
  assert.ok((await login(db, "Laboratorio Millet", r.code)).ok);
});

test("login: válido, normalización de empresa, errores indistinguibles", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  const ok = await login(db, "  laboratorio   MILLET ", code.toLowerCase());
  assert.ok(ok.ok);
  const bad = [
    await login(db, "Empresa Inexistente", code),
    await login(db, "Laboratorio Millet", "STK-AAAAA-AAAAA"),
    await login(db, "", ""),
  ];
  for (const b of bad) assert.deepEqual(b, { ok: false, reason: "invalid" });
  await clients.setActive(db, id, false);
  assert.deepEqual(await login(db, "Laboratorio Millet", code), { ok: false, reason: "invalid" });
});

test("sesión: guarda solo sha256, valida contra DB, revocación, expiración, cliente inactivo", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  const now = new Date("2026-11-04T12:00:00Z");
  const r = await login(db, "Laboratorio Millet", code, { now });
  const [row] = await db.query(`SELECT token_hash, ip_hash, user_agent FROM client_sessions`);
  assert.equal(row.token_hash, hashToken(r.token));
  assert.notEqual(row.token_hash, r.token);
  assert.equal((await resolveSessionCore(db, hashToken(r.token), now)).clientId, id);
  assert.equal(await resolveSessionCore(db, hashToken("otro"), now), null);
  // expira a los 30 días
  assert.equal(await resolveSessionCore(db, hashToken(r.token), new Date("2026-12-05T12:00:00Z")), null);
  // inactivo: inválida de inmediato
  await clients.setActive(db, id, false);
  assert.equal(await resolveSessionCore(db, hashToken(r.token), now), null);
  await clients.setActive(db, id, true);
  assert.ok(await resolveSessionCore(db, hashToken(r.token), now));
  // revocación
  assert.equal(await clients.revokeSessions(db, id), 1);
  assert.equal(await resolveSessionCore(db, hashToken(r.token), now), null);
});

test("regenerar con 'cerrar sesiones' revoca; sin tildar mantiene", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  const s1 = await login(db, "Laboratorio Millet", code);
  await clients.generateAccess(db, id, { revokeSessions: false, pepper: PEPPER });
  assert.ok(await resolveSessionCore(db, hashToken(s1.token)));
  const a = await clients.generateAccess(db, id, { revokeSessions: true, pepper: PEPPER });
  assert.equal(a.sessionsRevoked, 1);
  assert.equal(await resolveSessionCore(db, hashToken(s1.token)), null);
});

test("rate limit por IP", async () => {
  const db = await setup();
  const { code } = await seedClient(db);
  for (let i = 0; i < IP_LIMIT; i++) await login(db, "Nadie", "x");
  assert.deepEqual(await login(db, "Laboratorio Millet", code), { ok: false, reason: "throttled" });
});

test("bloqueo IP+cliente a los 5 fallos (el código correcto tampoco entra) y bloqueo del cliente escalonado", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  const now = new Date("2026-11-04T12:00:00Z");
  for (let i = 0; i < PAIR_FAILS; i++) await login(db, "Laboratorio Millet", "STK-AAAAA-AAAAA", { now });
  assert.deepEqual(await login(db, "Laboratorio Millet", code, { now }), { ok: false, reason: "invalid" });
  // otra IP sí entra
  assert.ok((await attemptLogin(db, { company: "Laboratorio Millet", code, ipHash: "otra", pepper: PEPPER, now })).ok);

  // bloqueo por cliente: CLIENT_FAILS fallos desde varias IP
  const db2 = await setup();
  const c2 = await seedClient(db2);
  for (let i = 0; i < CLIENT_FAILS; i++) {
    await attemptLogin(db2, { company: c2.name, code: "STK-AAAAA-AAAAA", ipHash: `ip${i}`, pepper: PEPPER, now });
  }
  const [locked] = await db2.query(`SELECT locked_until, lockouts FROM clients WHERE id=$1`, [c2.id]);
  assert.equal(locked.lockouts, 1);
  assert.equal(new Date(locked.locked_until) - now, 15 * 60000);
  assert.deepEqual(await attemptLogin(db2, { company: c2.name, code: c2.code, ipHash: "nueva", pepper: PEPPER, now }), { ok: false, reason: "invalid" });
  const later = new Date(now.getTime() + 16 * 60000);
  assert.ok((await attemptLogin(db2, { company: c2.name, code: c2.code, ipHash: "nueva", pepper: PEPPER, now: later })).ok);
  assert.ok(id);
});

test("activity log: eventos sin secretos", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  await login(db, "Laboratorio Millet", code);
  await clients.setActive(db, id, false);
  const cid = await content.createContent(db, id, { title: "Reel 1", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-10T18:00" });
  await content.updateContent(db, cid, { copy: "hola", scheduledLocal: "2026-11-11T18:00" });
  await content.changeStatus(db, cid, "idea" === "idea" ? "production" : "x");
  await content.changeStatus(db, cid, "review");
  await content.changeStatus(db, cid, "client_review");
  await content.registerExternalApproval(db, cid, { approverName: "Ana Pérez" });
  await content.changeStatus(db, cid, "published");
  const ev = (await db.query(`SELECT event FROM activity_log ORDER BY seq`)).map((r) => r.event);
  for (const e of ["client.created", "access.generated", "login.success", "client.deactivated", "content.created",
    "content.updated", "content.rescheduled", "content.status_changed", "content.published"]) assert.ok(ev.includes(e), e);
  assert.ok(!JSON.stringify(await db.query(`SELECT data FROM activity_log`)).includes(code));
});

test("máquina de estados y efectos", async () => {
  const db = await setup();
  const { id } = await seedClient(db);
  const cid = await content.createContent(db, id, { title: "T", platform: "tiktok", contentType: "video" });
  await assert.rejects(content.changeStatus(db, cid, "published"), /No se puede pasar/);
  await content.changeStatus(db, cid, "production");
  await content.changeStatus(db, cid, "review");
  await content.changeStatus(db, cid, "client_review");
  assert.ok((await content.getContent(db, cid)).sentToClientAt);
  await assert.rejects(content.changeStatus(db, cid, "changes_requested"), /registra el cliente/);
  await assert.rejects(content.changeStatus(db, cid, "approved"), /registra el cliente/);
  await content.changeStatus(db, cid, "production");
  await content.changeStatus(db, cid, "cancelled");
  await content.changeStatus(db, cid, "idea");
  await assert.rejects(content.changeStatus(db, cid, "bogus"), /inválido/);
  // versión: título sube, notas internas no
  const v0 = (await content.getContent(db, cid)).version;
  await content.updateContent(db, cid, { internalNotes: "x" });
  assert.equal((await content.getContent(db, cid)).version, v0);
  await content.updateContent(db, cid, { title: "T2" });
  assert.equal((await content.getContent(db, cid)).version, v0 + 1);
});

test("visibilidad por estado + DTO sin campos internos", async () => {
  const db = await setup();
  const { id } = await seedClient(db);
  const repo = contentRepo(sq(db));
  const scope = sessionScope(id);
  const mk = (title) => content.createContent(db, id, { title, platform: "instagram", contentType: "post",
    scheduledLocal: "2026-11-10T10:00", copy: "COPY-SECRETO?", internalNotes: "INTERNA", assignee: "Ana", clientNotes: "nota cliente", previewUrl: "https://x.test/p" });
  const ids = {};
  for (const s of ["idea", "production", "review", "client_review", "changes_requested", "approved", "scheduled", "published", "cancelled"]) {
    ids[s] = await mk(`T-${s}`);
    await db.query(`UPDATE content_items SET status=$2 WHERE id=$1`, [ids[s], s]);
  }
  const range = { start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") };
  const list = await repo.listVisible(scope, range);
  assert.deepEqual(list.map((c) => c.status).sort(), ["approved", "changes_requested", "client_review", "production", "published", "scheduled"]);
  const prod = list.find((c) => c.status === "production");
  assert.deepEqual(Object.keys(prod).sort(), ["id", "minimal", "scheduledAt", "status", "statusLabel", "title"]);
  const whole = JSON.stringify(list);
  assert.ok(!whole.includes("INTERNA") && !whole.includes("Ana") && !/internal|assignee|sent_to_client/i.test(whole));
  for (const s of ["idea", "review", "cancelled"]) assert.equal(await repo.getVisible(scope, ids[s]), null, s);
  assert.equal((await repo.getVisible(scope, ids.client_review)).copy, "COPY-SECRETO?");
  assert.equal((await repo.getVisible(scope, ids.production)).copy, undefined);
});

test("IDOR: el contenido y perfil de otro cliente no son alcanzables; 404 uniforme", async () => {
  const db = await setup();
  const a = await seedClient(db, "Cliente A");
  const b = await seedClient(db, "Cliente B");
  const repo = contentRepo(sq(db));
  const cidB = await content.createContent(db, b.id, { title: "Privado B", platform: "web", contentType: "post", scheduledLocal: "2026-11-10T10:00" });
  await db.query(`UPDATE content_items SET status='published' WHERE id=$1`, [cidB]);
  const scopeA = sessionScope(a.id);
  assert.equal(await repo.getVisible(scopeA, cidB), null);
  assert.equal(await repo.getVisible(scopeA, "no-existe"), null);
  assert.equal(await repo.getVisible(scopeA, { $ne: 1 }), null);
  const list = await repo.listVisible(scopeA, { start: new Date("2026-01-01"), end: new Date("2027-01-01") });
  assert.equal(list.length, 0);
  assert.equal((await repo.getProfile(scopeA)).name, "Cliente A");
  // un objeto parecido a un scope (p. ej. de un body JSON) no sirve
  await assert.rejects(repo.listUndated({ clientId: b.id }), /ClientScope/);
});

test("resumen: meta del mes, fallback al default, progreso", async () => {
  const db = await setup();
  const { id } = await seedClient(db);
  const repo = contentRepo(sq(db));
  const scope = sessionScope(id);
  const mk = async (status, local) => {
    const c = await content.createContent(db, id, { title: status, platform: "web", contentType: "post", scheduledLocal: local });
    await db.query(`UPDATE content_items SET status=$2 WHERE id=$1`, [c, status]);
  };
  for (let i = 0; i < 3; i++) await mk("published", `2026-11-0${i + 1}T10:00`);
  await mk("scheduled", "2026-11-20T10:00");
  await mk("production", "2026-11-25T10:00");
  await mk("idea", "2026-11-26T10:00"); // invisible: no cuenta
  await mk("published", "2026-12-01T00:30"); // Dic en BA => no cuenta en noviembre
  const s = await repo.monthSummary(scope, "2026-11", 12);
  assert.deepEqual([s.contracted, s.published, s.scheduled, s.production, s.progress], [12, 3, 1, 1, 25]);
  await clients.setMonthGoal(db, id, "2026-11", 6);
  assert.equal((await repo.monthSummary(scope, "2026-11", 12)).progress, 50);
});

test("zona horaria: 31/10 23:30 en Buenos Aires cae en octubre", async () => {
  const db = await setup();
  const { id } = await seedClient(db);
  const repo = contentRepo(sq(db));
  const scope = sessionScope(id);
  const c = await content.createContent(db, id, { title: "borde", platform: "web", contentType: "post", scheduledLocal: "2026-10-31T23:30" });
  await db.query(`UPDATE content_items SET status='scheduled' WHERE id=$1`, [c]);
  assert.equal((await repo.monthSummary(scope, "2026-10", 0)).scheduled, 1);
  assert.equal((await repo.monthSummary(scope, "2026-11", 0)).scheduled, 0);
});

test("revokeAllSessions ya revocadas no cuenta de nuevo", async () => {
  const db = await setup();
  const { id, code } = await seedClient(db);
  await login(db, "Laboratorio Millet", code);
  assert.equal(await revokeAllSessions(db, id), 1);
  assert.equal(await revokeAllSessions(db, id), 0);
});

test("desbloquear acceso: limpia bloqueos, no toca código ni sesiones, registra actividad", async () => {
  const db = await setup();
  const { id, code, name } = await seedClient(db);
  const now = new Date();
  const live = await attemptLogin(db, { company: name, code, ipHash: "viva", pepper: PEPPER, now });
  for (let i = 0; i < CLIENT_FAILS; i++) await attemptLogin(db, { company: name, code: "STK-AAAAA-AAAAA", ipHash: `ip${i}`, pepper: PEPPER, now });
  assert.equal((await attemptLogin(db, { company: name, code, ipHash: "x", pepper: PEPPER, now })).ok, false);
  const [{ code_hash: before }] = await db.query(`SELECT code_hash FROM clients WHERE id=$1`, [id]);
  await clients.unlockAccess(db, id);
  const [c] = await db.query(`SELECT code_hash, locked_until, failed_attempts, lockouts FROM clients WHERE id=$1`, [id]);
  assert.equal(c.code_hash, before);
  assert.deepEqual([c.locked_until, c.failed_attempts, c.lockouts], [null, 0, 0]);
  assert.ok(await resolveSessionCore(db, hashToken(live.token), now), "la sesión existente sigue viva");
  assert.ok((await attemptLogin(db, { company: name, code, ipHash: "ip0", pepper: PEPPER, now })).ok, "el par IP+cliente también se libera");
  assert.equal((await db.query(`SELECT 1 FROM activity_log WHERE event='client.access_unlocked'`)).length, 1);
  await assert.rejects(clients.unlockAccess(db, "nope"), /no encontrado/);
});
