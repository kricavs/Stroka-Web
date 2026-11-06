import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as content from "../lib/studio/content-core.js";
import * as files from "../lib/files/files-core.js";
import * as rules from "../lib/files/rules.js";
import * as intentLib from "../lib/files/intent.js";
import { createFsStorage, createBlobStorage } from "../lib/files/storage-core.js";
import { deliverFile } from "../lib/files/deliver-core.js";
import { filesRepo, groupFiles, recordDownload, shouldLogDownload } from "../lib/portal/files-core.js";
import { mintScope, assertScope, scopedRunner } from "../lib/portal/scope-core.js";

const SECRET = "s".repeat(40);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');

const sq = (db) => (scope, sql, params = [], opts) => (assertScope(scope), scopedRunner(db.query, scope)(sql, params, opts));
const setup = async () => {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const storage = createFsStorage(mkdtempSync(join(tmpdir(), "stk-files-")));
  const mkClient = async (name) => {
    const id = await clients.createClient(db, { name });
    return { id, scope: mintScope({ clientId: id, source: "session", sessionId: "s", displayName: "Ana Ruiz" }) };
  };
  return { db, storage, mkClient, repo: filesRepo(sq(db)) };
};

// prepare → "browser uploads" → complete
async function upload(w, clientId, { filename = "logo.png", bytes = PNG, category = "logos", extra = {} } = {}) {
  const p = await files.prepareUpload(w.db, { clientId, category, filename, size: bytes.length, contentId: extra.contentId }, { secret: SECRET });
  await w.storage.put(p.pathname, bytes);
  return files.completeUpload(w.db, w.storage, { pathname: p.pathname, intent: p.intent, clientId, category, name: "Logo", originalName: filename, ...extra }, { secret: SECRET, log: () => {} });
}

test("migración 4: tabla, FK compuesta, unicidades", async () => {
  const w = await setup();
  assert.deepEqual((await w.db.query(`select id from schema_migrations order by id`)).map((r) => r.id), MIGRATIONS.map((m) => m.id)); // fase 3 añadió la 4; las siguientes no la tocan
  assert.deepEqual((await runMigrations(w.db, MIGRATIONS)).applied, []);
  const a = await w.mkClient("A"), b = await w.mkClient("B");
  const cid = await content.createContent(w.db, a.id, { title: "x", platform: "web", contentType: "post" });
  await assert.rejects(w.db.query(
    `INSERT INTO client_files (id,client_id,content_id,category,name,original_name,blob_pathname,mime,size,group_key,uploaded_by_type)
     VALUES ('f1','${b.id}','${cid}','logos','n','n','p1','image/png',1,'g','studio')`), "content de otro cliente");
  await assert.rejects(w.db.query(
    `INSERT INTO client_files (id,client_id,category,name,original_name,blob_pathname,mime,size,group_key,uploaded_by_type)
     VALUES ('f2','${a.id}','nope','n','n','p2','image/png',1,'g','studio')`), "categoría");
});

test("reglas: tipos permitidos y rechazados", () => {
  for (const f of ["a.png", "a.JPG", "a.jpeg", "a.webp", "a.avif", "a.pdf", "a.zip"]) assert.ok(rules.checkFilename(f, 100).ok, f);
  for (const f of ["a.svg", "a.html", "a.htm", "a.exe", "a.js", "a.sh", "a.php", "a.mp4", "a.mov", "a", "a.png.exe", ".png", "a.svgz", "a.dmg", "a.bat"]) assert.equal(rules.checkFilename(f, 100).ok, f === ".png" ? true : false, f);
  assert.ok(!rules.checkFilename("a.png", 0).ok);
  assert.ok(!rules.checkFilename("a.png", 25 * rules.MB + 1).ok);
  assert.ok(rules.checkFilename("a.png", 25 * rules.MB).ok);
  assert.ok(!rules.checkFilename("a.pdf", 50 * rules.MB + 1).ok);
  assert.ok(!rules.checkFilename("a.zip", 100 * rules.MB + 1).ok);
});

test("magic numbers", () => {
  assert.equal(rules.sniffMime(PNG), "image/png");
  assert.equal(rules.sniffMime(JPG), "image/jpeg");
  assert.equal(rules.sniffMime(PDF), "application/pdf");
  assert.equal(rules.sniffMime(ZIP), "application/zip");
  assert.equal(rules.sniffMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(rules.sniffMime(Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])), "image/avif");
  for (const bad of [HTML, EXE, SVG, new Uint8Array(0)]) assert.equal(rules.sniffMime(bad), null);
});

test("nombres de blob: sanitizados, sin traversal, con colisión imposible", () => {
  const a = rules.buildPathname({ clientId: "cli_abc123", category: "logos", uuid: "a".repeat(32), filename: "../../Ñandú Logo (final).PNG", ext: "png" });
  assert.equal(a, `clients/cli_abc123/logos/${"a".repeat(32)}-nandu-logo-final.png`);
  assert.ok(rules.isSafePathname(a, "cli_abc123", "logos"));
  for (const bad of ["../x.png", `clients/cli_abc123/logos/../../${"a".repeat(32)}-x.png`, `clients/other/logos/${"a".repeat(32)}-x.png`, `clients/cli_abc123/photos/${"a".repeat(32)}-x.png`, `clients/cli_abc123/logos/${"a".repeat(32)}-x.svg`, "clients/cli_abc123/logos/x.png"]) {
    assert.ok(!rules.isSafePathname(bad, "cli_abc123", "logos"), bad);
  }
  assert.ok(!rules.isSafePathname(a, "cli_abc123/../x", "logos"));
  assert.throws(() => rules.buildPathname({ clientId: "../x", category: "logos", uuid: "a".repeat(32), filename: "a.png", ext: "png" }));
  assert.notEqual(
    rules.buildPathname({ clientId: "c", category: "logos", uuid: "a".repeat(32), filename: "a.png", ext: "png" }),
    rules.buildPathname({ clientId: "c", category: "logos", uuid: "b".repeat(32), filename: "a.png", ext: "png" }));
});

test("intent: válido, vencido, adulterado, de otro archivo", () => {
  const d = { pathname: "p", clientId: "c", category: "logos", maxBytes: 10 };
  const i = intentLib.makeIntent(d, SECRET, 1000);
  assert.ok(intentLib.verifyIntent(i, d, SECRET, 2000));
  assert.ok(!intentLib.verifyIntent(i, d, SECRET, 1000 + 31 * 60 * 1000), "vencido");
  assert.ok(!intentLib.verifyIntent(i, { ...d, pathname: "q" }, SECRET, 2000));
  assert.ok(!intentLib.verifyIntent(i, { ...d, maxBytes: 11 }, SECRET, 2000));
  assert.ok(!intentLib.verifyIntent(i, d, "x".repeat(40), 2000));
  assert.ok(!intentLib.verifyIntent("", d, SECRET) && !intentLib.verifyIntent("1.x", d, SECRET));
  const pn = `clients/c/logos/${"a".repeat(32)}-x.png`;
  const ok = { pathname: pn, clientId: "c", category: "logos", maxBytes: 25 * rules.MB };
  assert.ok(files.authorizeUploadToken({ ...ok, intent: intentLib.makeIntent(ok, SECRET) }, SECRET));
  assert.ok(!files.authorizeUploadToken({ ...ok, intent: intentLib.makeIntent({ ...ok, maxBytes: 1 }, SECRET) }, SECRET), "tope adulterado");
  assert.ok(!files.authorizeUploadToken({ ...ok, pathname: "../x.png", intent: intentLib.makeIntent(ok, SECRET) }, SECRET));
});

test("subida válida: fila, mime desde la tabla, actividad sin pathname", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const r = await upload(w, a.id, { filename: "Logo Horizontal.PNG" });
  const [f] = await w.db.query(`select * from client_files where id=$1`, [r.id]);
  assert.deepEqual([f.mime, f.version, f.group_key, f.access, f.is_final, f.uploaded_by_type, f.original_name], ["image/png", 1, r.id, "private", false, "studio", "Logo Horizontal.PNG"]);
  assert.match(f.blob_pathname, new RegExp(`^clients/${a.id}/logos/[0-9a-f]{32}-logo-horizontal\\.png$`));
  assert.equal(Number(f.size), PNG.length);
  const [ev] = await w.db.query(`select event, data from activity_log where event like 'file.%'`);
  assert.equal(ev.event, "file.uploaded");
  assert.ok(!JSON.stringify(ev.data).includes("clients/"), "sin pathname en la actividad");
});

test("validación por contenido real: MIME/extensión falsos se rechazan y el blob se borra", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  for (const [filename, bytes] of [["foto.png", PDF], ["doc.pdf", HTML], ["pack.zip", EXE], ["img.jpg", PNG], ["a.webp", JPG], ["x.pdf", SVG]]) {
    const p = await files.prepareUpload(w.db, { clientId: a.id, category: "other", filename, size: bytes.length }, { secret: SECRET });
    await w.storage.put(p.pathname, bytes);
    await assert.rejects(files.completeUpload(w.db, w.storage, { pathname: p.pathname, intent: p.intent, clientId: a.id, category: "other", name: "n" }, { secret: SECRET, log: () => {} }), /no coincide/, filename);
    assert.equal(await w.storage.inspect(p.pathname), null, "blob eliminado: " + filename);
  }
  assert.equal((await w.db.query(`select 1 from client_files`)).length, 0);
  await assert.rejects(files.prepareUpload(w.db, { clientId: a.id, category: "other", filename: "x.svg", size: 10 }, { secret: SECRET }), /no permitido/);
  await assert.rejects(files.prepareUpload(w.db, { clientId: a.id, category: "other", filename: "x.png", size: 26 * rules.MB }, { secret: SECRET }), /máximo/);
  await assert.rejects(files.prepareUpload(w.db, { clientId: a.id, category: "zzz", filename: "x.png", size: 10 }, { secret: SECRET }), /Categoría/);
});

test("tamaño real mayor al declarado se rechaza (no se confía en 'size')", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const p = await files.prepareUpload(w.db, { clientId: a.id, category: "other", filename: "x.png", size: 100 }, { secret: SECRET });
  const big = { ...w.storage, inspect: async () => ({ size: 26 * rules.MB, head: PNG }), remove: (x) => w.storage.remove(x) };
  await assert.rejects(files.completeUpload(w.db, big, { pathname: p.pathname, intent: p.intent, clientId: a.id, category: "other", name: "n" }, { secret: SECRET }), /máximo/);
});

test("autorización: intent ajeno, pathname de otro cliente, traversal, blob inexistente", async () => {
  const w = await setup();
  const a = await w.mkClient("A"), b = await w.mkClient("B");
  const p = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "x.png", size: 16 }, { secret: SECRET });
  await w.storage.put(p.pathname, PNG);
  const base = { pathname: p.pathname, intent: p.intent, category: "logos", name: "n" };
  await assert.rejects(files.completeUpload(w.db, w.storage, { ...base, clientId: b.id }, { secret: SECRET }), (e) => e.status === 403, "intent de A usado para B");
  await assert.rejects(files.completeUpload(w.db, w.storage, { ...base, clientId: a.id, intent: "1.x" }, { secret: SECRET }), (e) => e.status === 403);
  await assert.rejects(files.completeUpload(w.db, w.storage, { ...base, clientId: a.id, pathname: "../../etc/passwd" }, { secret: SECRET }), (e) => e.status === 403);
  assert.ok(await w.storage.inspect(p.pathname), "no se borró el blob legítimo por un intento ajeno");
  const p2 = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "y.png", size: 16 }, { secret: SECRET });
  await assert.rejects(files.completeUpload(w.db, w.storage, { pathname: p2.pathname, intent: p2.intent, clientId: a.id, category: "logos", name: "n" }, { secret: SECRET }), /No se encontró/);
  const c = await content.createContent(w.db, b.id, { title: "de B", platform: "web", contentType: "post" });
  await assert.rejects(files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "x.png", size: 16, contentId: c }, { secret: SECRET }), /no pertenece/);
  await assert.rejects(files.prepareUpload(w.db, { clientId: "nope", category: "logos", filename: "x.png", size: 16 }, { secret: SECRET }), (e) => e.status === 404);
  assert.equal(files.authorizeUploadToken({ pathname: `clients/${a.id}/logos/${"a".repeat(32)}-x.png`, intent: "x", clientId: a.id, category: "logos", maxBytes: 1 }, SECRET), false);
});

test("doble complete: 409 y el blob del primero se conserva", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const p = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "x.png", size: 16 }, { secret: SECRET });
  await w.storage.put(p.pathname, PNG);
  const input = { pathname: p.pathname, intent: p.intent, clientId: a.id, category: "logos", name: "n" };
  const res = await Promise.allSettled([1, 2, 3, 4].map(() => files.completeUpload(w.db, w.storage, input, { secret: SECRET, log: () => {} })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(res.filter((r) => r.status === "rejected").every((r) => r.reason.status === 409));
  assert.equal((await w.db.query(`select 1 from client_files`)).length, 1);
  assert.ok(await w.storage.inspect(p.pathname), "el blob sigue ahí");
});

test("compensación: si falla la DB se borra el blob; si no se puede, queda registrado el huérfano", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  await w.db.query(`ALTER TABLE client_files ADD CONSTRAINT boom CHECK (name <> 'explota')`);
  const p = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "x.png", size: 16 }, { secret: SECRET });
  await w.storage.put(p.pathname, PNG);
  const input = { pathname: p.pathname, intent: p.intent, clientId: a.id, category: "logos", name: "explota" };
  await assert.rejects(files.completeUpload(w.db, w.storage, input, { secret: SECRET, log: () => {} }));
  assert.equal(await w.storage.inspect(p.pathname), null, "blob compensado");
  assert.equal((await w.db.query(`select 1 from client_files`)).length, 0);
  assert.equal((await w.db.query(`select 1 from activity_log where event like 'file.%'`)).length, 0, "la actividad hizo rollback");
  // el borrado también falla → huérfano registrado
  const p2 = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "y.png", size: 16 }, { secret: SECRET });
  await w.storage.put(p2.pathname, PNG);
  const logs = [];
  const flaky = { ...w.storage, remove: async () => { throw new Error("blob caído"); } };
  await assert.rejects(files.completeUpload(w.db, flaky, { pathname: p2.pathname, intent: p2.intent, clientId: a.id, category: "logos", name: "explota" }, { secret: SECRET, log: (m) => logs.push(m) }));
  assert.ok(logs.some((l) => l.includes("orphan blob") && l.includes(p2.pathname)));
  // Blob falló antes de la DB: el blob no existe → no hay registro
  const p3 = await files.prepareUpload(w.db, { clientId: a.id, category: "logos", filename: "z.png", size: 16 }, { secret: SECRET });
  await assert.rejects(files.completeUpload(w.db, w.storage, { pathname: p3.pathname, intent: p3.intent, clientId: a.id, category: "logos", name: "n" }, { secret: SECRET }), /No se encontró/);
});

test("mismo nombre dos veces: pathnames distintos, dos registros", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const [x, y] = await Promise.all([upload(w, a.id), upload(w, a.id)]);
  const rows = await w.db.query(`select blob_pathname from client_files`);
  assert.equal(new Set(rows.map((r) => r.blob_pathname)).size, 2);
  assert.notEqual(x.groupKey, y.groupKey, "son archivos distintos, no versiones");
});

test("versiones simultáneas del mismo grupo: sin duplicados de versión", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const v1 = await upload(w, a.id, { category: "deliverables", filename: "video.zip", bytes: ZIP });
  const res = await Promise.allSettled(Array.from({ length: 6 }, () => upload(w, a.id, { category: "deliverables", filename: "video.zip", bytes: ZIP, extra: { newVersionOf: v1.id } })));
  assert.ok(res.every((r) => r.status === "fulfilled"), JSON.stringify(res.filter((r) => r.status === "rejected").map((r) => r.reason?.message)));
  const vs = (await w.db.query(`select version from client_files where group_key=$1 order by version`, [v1.groupKey])).map((r) => r.version);
  assert.deepEqual(vs, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal((await w.db.query(`select 1 from activity_log where event='file.version_added'`)).length, 6);
  await assert.rejects(upload(w, a.id, { extra: { newVersionOf: "nope" } }), (e) => e.status === 404);
  const b = await w.mkClient("B");
  await assert.rejects(upload(w, b.id, { extra: { newVersionOf: v1.id } }), (e) => e.status === 404, "no se versiona un archivo de otro cliente");
});

test("entregable final: uno por grupo, concurrente, y al subir", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const v1 = await upload(w, a.id, { category: "deliverables", filename: "v.zip", bytes: ZIP, extra: { markFinal: true } });
  const v2 = await upload(w, a.id, { category: "deliverables", filename: "v.zip", bytes: ZIP, extra: { newVersionOf: v1.id, markFinal: true } });
  const finals = async () => (await w.db.query(`select id from client_files where group_key=$1 and is_final`, [v1.groupKey])).map((r) => r.id);
  assert.deepEqual(await finals(), [v2.id], "marcar final al subir desmarca la anterior");
  await Promise.all([files.setFinal(w.db, v1.id), files.setFinal(w.db, v2.id), files.setFinal(w.db, v1.id), files.setFinal(w.db, v2.id)]);
  assert.equal((await finals()).length, 1, "nunca dos finales");
  await files.setFinal(w.db, v1.id, false);
  assert.equal((await finals()).length, 0);
  await assert.rejects(files.setFinal(w.db, "nope"), (e) => e.status === 404);
  await assert.rejects(w.db.query(`update client_files set is_final=true where group_key=$1`, [v1.groupKey]), "el índice parcial lo impide");
});

test("archivar: no aparece, no se descarga, no se duplica; descarga en curso no se corta", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const r = await upload(w, a.id, { category: "deliverables", filename: "e.pdf", bytes: PDF, extra: { markFinal: true } });
  const [{ blob_pathname }] = await w.db.query(`select blob_pathname from client_files where id=$1`, [r.id]);
  const opened = await w.storage.open(blob_pathname); // descarga ya iniciada
  assert.equal((await w.repo.getForDownload(a.scope, r.id)).id, r.id);
  await Promise.all([files.archiveFile(w.db, r.id), files.archiveFile(w.db, r.id).catch((e) => e)]);
  assert.equal(await w.repo.getForDownload(a.scope, r.id), null);
  assert.deepEqual(await w.repo.listFiles(a.scope), []);
  const chunks = []; for await (const c of opened.stream) chunks.push(c);
  assert.equal(Buffer.concat(chunks).length, PDF.length, "la descarga iniciada termina");
  assert.ok(await w.storage.inspect(blob_pathname), "los bytes siguen hasta el purgado manual");
  await assert.rejects(files.archiveFile(w.db, r.id), (e) => e.status === 404);
  assert.equal((await w.db.query(`select 1 from activity_log where event='file.archived'`)).length, 1);
  assert.equal((await w.db.query(`select is_final from client_files where id=$1`, [r.id]))[0].is_final, false);
});

test("purgado manual de archivados: dry-run, por antigüedad y auditoría", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const old = await upload(w, a.id), fresh = await upload(w, a.id);
  await files.archiveFile(w.db, old.id); await files.archiveFile(w.db, fresh.id);
  await w.db.query(`update client_files set deleted_at = now() - interval '40 days' where id=$1`, [old.id]);
  assert.deepEqual(await files.purgeArchived(w.db, w.storage, { olderThanDays: 30 }), { candidates: 1, purged: 0 });
  await assert.rejects(files.purgeArchived(w.db, w.storage, { olderThanDays: 30, dryRun: false }), /Confirmación inválida/);
  await assert.rejects(files.purgeArchived(w.db, w.storage, { olderThanDays: 30, dryRun: false, confirm: 5 }), /Confirmación inválida/);
  assert.deepEqual(await files.purgeArchived(w.db, w.storage, { olderThanDays: 30, dryRun: false, confirm: 1 }), { candidates: 1, purged: 1 });
  const [o] = await w.db.query(`select blob_pathname, purged_at from client_files where id=$1`, [old.id]);
  assert.ok(o.purged_at); assert.equal(await w.storage.inspect(o.blob_pathname), null);
  assert.equal((await files.purgeArchived(w.db, w.storage, { olderThanDays: 30, dryRun: false, confirm: 0 })).candidates, 0);
  assert.equal((await w.db.query(`select 1 from client_files`)).length, 2, "las filas se conservan para auditoría");
});

test("aislamiento: archivo de otro cliente = null (404); listados separados; DTO sin datos técnicos", async () => {
  const w = await setup();
  const a = await w.mkClient("A"), b = await w.mkClient("B");
  const fa = await upload(w, a.id, { category: "deliverables", filename: "a.pdf", bytes: PDF });
  await upload(w, b.id, { category: "deliverables", filename: "b.pdf", bytes: PDF });
  assert.equal(await w.repo.getForDownload(b.scope, fa.id), null);
  assert.equal(await w.repo.getForDownload(b.scope, "nope"), null);
  assert.equal(await w.repo.getForDownload(b.scope, { $ne: 1 }), null);
  assert.equal((await w.repo.listFiles(a.scope)).length, 1);
  assert.equal((await w.repo.listFiles(b.scope)).length, 1);
  await assert.rejects(w.repo.listFiles({ clientId: a.id }), /ClientScope/);
  const [dto] = await w.repo.listFiles(a.scope);
  assert.deepEqual(Object.keys(dto).sort(), ["category", "categoryLabel", "createdAt", "description", "groupKey", "id", "isFinal", "kind", "name", "size", "version"]);
  assert.ok(!JSON.stringify(dto).includes("clients/") && !JSON.stringify(dto).includes("Stroka"));
});

test("visibilidad: oculto al cliente, y archivo de contenido solo si el contenido es visible", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const cid = await content.createContent(w.db, a.id, { title: "Reel", platform: "web", contentType: "post" });
  const att = await upload(w, a.id, { category: "content", filename: "r.pdf", bytes: PDF, extra: { contentId: cid } });
  const hidden = await upload(w, a.id, { category: "documents", filename: "i.pdf", bytes: PDF, extra: { clientVisible: false } });
  const plain = await upload(w, a.id, { category: "documents", filename: "p.pdf", bytes: PDF });
  const ids = async () => (await w.repo.listFiles(a.scope)).map((f) => f.id).sort();
  assert.deepEqual(await ids(), [plain.id], "contenido en idea ⇒ su archivo no se ve; oculto tampoco");
  for (const status of ["production", "review"]) { await w.db.query(`update content_items set status=$2 where id=$1`, [cid, status]); assert.equal(await w.repo.getForDownload(a.scope, att.id), null, status); }
  await w.db.query(`update content_items set status='client_review' where id=$1`, [cid]);
  assert.deepEqual(await ids(), [att.id, plain.id].sort());
  assert.deepEqual((await w.repo.listForContent(a.scope, cid)).map((f) => f.id), [att.id]);
  assert.equal(await w.repo.getForDownload(a.scope, hidden.id), null);
  await files.setVisibility(w.db, hidden.id, true);
  assert.ok(await w.repo.getForDownload(a.scope, hidden.id));
  assert.deepEqual(await w.repo.listForContent(a.scope, "no-existe"), []);
  assert.equal(await w.repo.deliverableCount(a.scope), 0);
});

test("versionado en portal: la más nueva primero y las anteriores agrupadas", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const v1 = await upload(w, a.id, { category: "deliverables", filename: "l.zip", bytes: ZIP });
  await upload(w, a.id, { category: "deliverables", filename: "l.zip", bytes: ZIP, extra: { newVersionOf: v1.id } });
  const v3 = await upload(w, a.id, { category: "deliverables", filename: "l.zip", bytes: ZIP, extra: { newVersionOf: v1.id, markFinal: true } });
  await upload(w, a.id, { category: "logos", filename: "x.png" });
  const groups = groupFiles(await w.repo.listFiles(a.scope));
  assert.deepEqual(groups.map((g) => g.label), ["Entregables", "Logos"]);
  const g = groups[0].groups[0];
  assert.deepEqual([g.latest.version, g.latest.isFinal, g.older.map((o) => o.version)], [3, true, [2, 1]]);
  assert.equal(g.latest.id, v3.id);
  assert.equal(await w.repo.deliverableCount(a.scope), 1, "cuenta entregables, no versiones");
});

test("descargas: se registran solo entregables/documentos/finales y solo sesiones reales", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const d = await upload(w, a.id, { category: "deliverables", filename: "e.pdf", bytes: PDF });
  const ph = await upload(w, a.id, { category: "photos", filename: "f.jpg", bytes: JPG });
  const fin = await upload(w, a.id, { category: "photos", filename: "g.jpg", bytes: JPG, extra: { markFinal: true } });
  const dl = async (scope, id) => recordDownload(w.db, scope, await w.repo.getForDownload(a.scope, id));
  assert.equal(await dl(a.scope, d.id), true);
  assert.equal(await dl(a.scope, ph.id), false, "foto de branding: no ensucia el log");
  assert.equal(await dl(a.scope, fin.id), true, "final siempre");
  assert.equal(await dl(mintScope({ clientId: a.id, source: "admin-preview" }), d.id), false, "admin-preview no registra");
  const rows = await w.db.query(`select actor_name, data from activity_log where event='file.downloaded'`);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0].data).sort(), ["category", "fileId", "final", "name", "version"]);
  assert.ok(shouldLogDownload({ category: "documents" }) && !shouldLogDownload({ category: "logos", is_final: false }));
});

test("adaptador Blob: usa el token privado explícito y access private", async () => {
  const calls = [];
  const stream = () => new ReadableStream({ start(c) { c.enqueue(PNG); c.close(); } });
  const sdk = {
    get: async (p, o) => (calls.push(["get", p, o]), p === "missing" ? null : { statusCode: 200, stream: stream(), blob: { size: 16, contentType: "image/png" } }),
    del: async (p, o) => calls.push(["del", p, o]),
  };
  const st = createBlobStorage({ token: "tok_private", sdk });
  const ins = await st.inspect("clients/x/a.png");
  assert.equal(ins.size, 16); assert.equal(rules.sniffMime(ins.head), "image/png");
  assert.equal(await st.inspect("missing"), null);
  await st.remove("clients/x/a.png");
  for (const [, , o] of calls) assert.equal(o.token, "tok_private");
  assert.equal(calls.find((c) => c[0] === "get")[2].access, "private");
  assert.throws(() => createBlobStorage({ token: "" }));
});

test("adaptador fs: no escapa del directorio", async () => {
  const st = createFsStorage(mkdtempSync(join(tmpdir(), "stk-fs-")));
  await assert.rejects(st.put("../../escape.txt", new Uint8Array([1])), /fuera del directorio/);
  assert.equal(await st.inspect("../../etc/passwd"), null);
  assert.ok(!existsSync("/tmp/escape.txt"));
});

test("Content-Disposition seguro", () => {
  const h = rules.contentDisposition("attachment", 'inf"orme\r\nX: y ñ.pdf');
  assert.ok(!/[\r\n]/.test(h) && h.startsWith("attachment;") && h.includes("filename*=UTF-8''"));
});

test("URL firmada: redirect corto a un pathname, sin token, sin guardarse", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const f = await upload(w, a.id, { category: "deliverables", filename: "e.pdf", bytes: PDF });
  const [row] = await w.db.query(`select * from client_files where id=$1`, [f.id]);
  const calls = [];
  const signing = { ...w.storage, presignGet: async (p, o) => (calls.push([p, o]), `https://store.private.blob.vercel-storage.com/${p}?sig=abc&vercel-blob-expires=1`) };
  const dl = await deliverFile({ file: row, storage: signing, inline: false });
  assert.equal(dl.status, 302);
  assert.equal(dl.headers.get("cache-control"), "private, no-store");
  assert.ok(dl.headers.get("location").includes(row.blob_pathname));
  assert.deepEqual(calls[0], [row.blob_pathname, { ttlSeconds: 120, download: true }]);
  assert.equal(dl.body, null, "sin bytes en la respuesta");
  const inl = await deliverFile({ file: row, storage: signing, inline: true });
  assert.equal(calls[1][1].download, false, "pdf inline: sin forzar descarga");
  assert.equal(inl.status, 302);
  const zip = await upload(w, a.id, { category: "documents", filename: "p.zip", bytes: ZIP });
  const [zrow] = await w.db.query(`select * from client_files where id=$1`, [zip.id]);
  await deliverFile({ file: zrow, storage: signing, inline: true });
  assert.equal(calls[2][1].download, true, "un ZIP nunca va inline aunque lo pidan");
  const acts = JSON.stringify(await w.db.query(`select data from activity_log`));
  assert.ok(!acts.includes("sig=") && !acts.includes("blob.vercel-storage"), "ninguna URL firmada en activity_log");
  const dbDump = JSON.stringify(await w.db.query(`select * from client_files`));
  assert.ok(!dbDump.includes("sig="), "ninguna URL firmada en la DB");
  // sin presign (dev/fs): se sirve el stream con cabeceras seguras
  const dev = await deliverFile({ file: row, storage: w.storage, inline: false });
  assert.equal(dev.status, 200);
  assert.match(dev.headers.get("content-disposition"), /^attachment;/);
  assert.equal(dev.headers.get("x-content-type-options"), "nosniff");
  assert.equal(dev.headers.get("content-type"), "application/pdf");
});

test("adaptador Blob: presignGet pide delegación GET de un solo pathname con vencimiento", async () => {
  const seen = {};
  const sdk = {
    issueSignedToken: async (o) => ((seen.issue = o), { delegationToken: "d", clientSigningToken: "c", validUntil: o.validUntil }),
    presignUrl: async (t, o) => ((seen.presign = [t, o]), { presignedUrl: `https://s.private.blob.vercel-storage.com/${o.pathname}?sig=x` }),
  };
  const st = createBlobStorage({ token: "tok_private", sdk });
  const url = await st.presignGet("clients/x/a.pdf", { download: true, now: 1_000_000 });
  assert.deepEqual(seen.issue.operations, ["get"]);
  assert.equal(seen.issue.pathname, "clients/x/a.pdf");
  assert.equal(seen.issue.validUntil, 1_000_000 + 120_000);
  assert.deepEqual([seen.presign[1].access, seen.presign[1].operation, seen.presign[1].validUntil], ["private", "get", 1_120_000]);
  assert.ok(url.includes("download=1") && !url.includes("tok_private"));
});

test("huérfanos: escaneo en seco, edad mínima, confirmación exacta", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const ok = await upload(w, a.id);
  await files.archiveFile(w.db, ok.id); // archivado: su blob sigue siendo suyo
  await w.storage.put(`clients/${a.id}/logos/${"c".repeat(32)}-huerfano.png`, PNG);
  await w.storage.put(`clients/${a.id}/logos/${"d".repeat(32)}-reciente.png`, PNG);
  const now = Date.now();
  // el "reciente" se escribe recién: con mtime actual solo es huérfano si pasó la edad mínima
  const old = await files.scanOrphanBlobs(w.db, w.storage, { minAgeMinutes: 0, now: now + 3 * 3600_000 });
  assert.equal(old.scanned, 3);
  assert.equal(old.orphans.length, 2);
  assert.deepEqual(Object.keys(old.orphans[0]).sort(), ["ageMinutes", "pathname", "size"]);
  const young = await files.scanOrphanBlobs(w.db, w.storage, { minAgeMinutes: 60, now });
  assert.equal(young.orphans.length, 0, "subidas recientes (en vuelo) no se tocan");
  assert.equal((await w.storage.list("clients/")).length, 3, "el escaneo no borra nada");
  await assert.rejects(files.removeOrphanBlobs(w.db, w.storage, { minAgeMinutes: 0, now: now + 3 * 3600_000 }), /Confirmación inválida/);
  await assert.rejects(files.removeOrphanBlobs(w.db, w.storage, { minAgeMinutes: 0, now: now + 3 * 3600_000, confirm: 1 }), /Confirmación inválida/);
  assert.deepEqual(await files.removeOrphanBlobs(w.db, w.storage, { minAgeMinutes: 0, now: now + 3 * 3600_000, confirm: 2 }), { removed: 2 });
  const left = await w.storage.list("clients/");
  assert.equal(left.length, 1);
  assert.equal(left[0].pathname, (await w.db.query(`select blob_pathname from client_files`))[0].blob_pathname, "el blob con fila (archivado) sobrevive");
});

test("TTL de la URL firmada: 120 s, una sola constante para Portal y Studio", async () => {
  const { SIGNED_URL_TTL_SECONDS } = await import("../lib/files/rules.js");
  assert.equal(SIGNED_URL_TTL_SECONDS, 120);
});

test("adaptador Blob: exists() usa lectura consistente (useCache:false) con el token privado", async () => {
  const seen = [];
  let gone = false;
  const sdk = { get: async (p, o) => (seen.push(o), gone ? null : { statusCode: 200 }) };
  const st = createBlobStorage({ token: "tok_private", sdk });
  assert.equal(await st.exists("clients/x/a.pdf"), true);
  gone = true;
  assert.equal(await st.exists("clients/x/a.pdf"), false);
  for (const o of seen) assert.deepEqual([o.access, o.useCache, o.token], ["private", false, "tok_private"]);
});

test("mantenimiento: purgado y huérfanos confirman el borrado con exists() y no marcan si el blob sigue", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const f = await upload(w, a.id);
  await w.db.query(`update client_files set deleted_at = now() - interval '40 days' where id=$1`, [f.id]);
  const stuck = { ...w.storage, remove: async () => {}, exists: async () => true }; // delete "succeeds" but the blob is still there
  const logs = [];
  const r = await files.purgeArchived(w.db, stuck, { olderThanDays: 30, dryRun: false, confirm: 1, log: (m) => logs.push(m) });
  assert.deepEqual(r, { candidates: 1, purged: 0 });
  assert.ok(logs[0].includes("sigue existiendo"));
  const [row] = await w.db.query(`select purged_at from client_files where id=$1`, [f.id]);
  assert.equal(row.purged_at, null);
  const ok = await files.purgeArchived(w.db, w.storage, { olderThanDays: 30, dryRun: false, confirm: 1 });
  assert.equal(ok.purged, 1);
});

test("nueva versión (regresión): V1 → V2 con el payload exacto que manda la UI", async () => {
  const w = await setup();
  const a = await w.mkClient("A");
  const cid = await content.createContent(w.db, a.id, { title: "Video campaña", platform: "web", contentType: "post" });
  const v1 = await upload(w, a.id, { category: "deliverables", filename: "campana.pdf", bytes: PDF, extra: { contentId: cid, clientVisible: false } });
  const [base] = await w.db.query(`select * from client_files where id=$1`, [v1.id]);
  // Lo que arma FileUploader para una nueva versión: category/contentId del base, newVersionOf, sin markFinal.
  const p = await files.prepareUpload(w.db, { clientId: a.id, category: base.category, filename: "campana-v2.pdf", size: PDF.length, contentId: base.content_id }, { secret: SECRET });
  await w.storage.put(p.pathname, PDF);
  const v2 = await files.completeUpload(w.db, w.storage, {
    pathname: p.pathname, intent: p.intent, clientId: a.id, category: base.category, name: base.name, originalName: "campana-v2.pdf",
    contentId: base.content_id, newVersionOf: base.id, markFinal: false, clientVisible: true,
  }, { secret: SECRET, log: () => {} });
  assert.equal(v2.version, 2);
  assert.equal(v2.groupKey, v1.groupKey);
  const rows = await w.db.query(`select id, version, blob_pathname, content_id, category from client_files where group_key=$1 order by version desc`, [v1.groupKey]);
  assert.deepEqual(rows.map((r) => r.version), [2, 1], "V2 primero");
  assert.notEqual(rows[0].blob_pathname, rows[1].blob_pathname);
  assert.ok(await w.storage.exists(rows[1].blob_pathname), "V1 sigue existiendo");
  assert.ok(rows.every((r) => r.content_id === cid && r.category === "deliverables"));
  await files.setFinal(w.db, v2.id);
  assert.equal((await w.db.query(`select id from client_files where group_key=$1 and is_final`, [v1.groupKey])).length, 1);
  const evs = (await w.db.query(`select event from activity_log where client_id=$1 order by created_at`, [a.id])).map((r) => r.event);
  assert.ok(evs.includes("file.version_added") && evs.includes("file.marked_final"));
});

test("nueva versión (regresión UI): cada destino remonta el uploader", () => {
  // FileUploader lee `open` solo al montar; sin una key distinta "Nueva versión" reutilizaba la instancia cerrada.
  assert.equal(rules.uploaderKey(null), "new");
  assert.notEqual(rules.uploaderKey({ id: "fil_a" }), rules.uploaderKey(null));
  assert.notEqual(rules.uploaderKey({ id: "fil_a" }), rules.uploaderKey({ id: "fil_b" }));
});
