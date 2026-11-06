// Client files — Studio write operations, db-injected (pg, PGlite, tests).
//
// Bytes and rows live in two systems, so there is no ACID across them. The
// order and the compensation are:
//   1. prepare:  Studio asks for a pathname (validated metadata, signed intent).
//                Nothing is written anywhere.
//   2. upload:   the browser sends the bytes straight to the private store.
//   3. complete: the server re-validates EVERYTHING from the stored bytes
//                (size, magic numbers vs extension). Only then does it insert
//                the row (+ activity) in ONE transaction.
//   Failure modes:
//     - validation fails          → the blob is deleted, no row.
//     - the DB transaction fails  → the blob is deleted (best effort); if the
//                                   delete itself fails it is logged as an
//                                   orphan (`[files] orphan blob …`).
//     - the browser never calls complete → an orphan blob with no row; it is
//                                   found by reconciling the store listing
//                                   against client_files (manual, documented).
//     - double "complete"         → blob_pathname is UNIQUE: the second call
//                                   gets 409 and never deletes the first one's blob.
// Archiving only sets deleted_at; the bytes stay until purgeArchived() runs
// (manually, after N days, dry-run first and then confirming the exact count),
// so a file is never lost by a misclick.
import { randomUUID } from "node:crypto";
import { logActivity, newId } from "../portal/activity-core.js";
import { InputError } from "../studio/errors.js";
import { cleanText } from "../shared/content.js";
import { makeIntent, verifyIntent } from "./intent.js";
import { FILE_CATEGORIES, buildPathname, checkFilename, extOf, isSafePathname, sniffMime } from "./rules.js";

const ACTOR = { actorType: "admin", actorName: "Stroka" };
const CATS = FILE_CATEGORIES.map(([k]) => k);

const lockGroup = (t, groupKey) => t.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`client_files:${groupKey}`]);

async function clientExists(q, clientId) {
  const [c] = await q.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
  if (!c) throw new InputError("Cliente no encontrado.", 404);
}

// content_id must belong to the same client.
async function checkContent(q, clientId, contentId) {
  if (!contentId) return null;
  const [c] = await q.query(`SELECT 1 FROM content_items WHERE id = $1 AND client_id = $2`, [contentId, clientId]);
  if (!c) throw new InputError("El contenido no pertenece a este cliente.", 400);
  return contentId;
}

export async function prepareUpload(db, { clientId, category, filename, size, contentId }, { secret, now = Date.now() }) {
  if (!CATS.includes(category)) throw new InputError("Categoría inválida.");
  const check = checkFilename(filename, Number(size));
  if (!check.ok) throw new InputError(check.error);
  await clientExists(db, clientId);
  await checkContent(db, clientId, contentId || null);
  const pathname = buildPathname({ clientId, category, uuid: randomUUID().replace(/-/g, ""), filename, ext: check.ext });
  const maxBytes = check.type.max;
  return { pathname, maxBytes, contentType: check.type.mime, intent: makeIntent({ pathname, clientId, category, maxBytes }, secret, now) };
}

// Validates the token request made by the browser's direct upload.
export function authorizeUploadToken({ pathname, intent, clientId, category, maxBytes }, secret, now = Date.now()) {
  return isSafePathname(pathname, clientId, category) && verifyIntent(intent, { pathname, clientId, category, maxBytes }, secret, now);
}

export async function completeUpload(db, storage, input, { secret, now = Date.now(), log = console.error } = {}) {
  const { pathname, intent, clientId, category } = input;
  const ext = extOf(pathname);
  const type = checkFilename(`x.${ext}`, 1).type;
  if (!type || !isSafePathname(pathname, clientId, category)) throw new InputError("Subida no autorizada.", 403);
  if (!verifyIntent(intent, { pathname, clientId, category, maxBytes: type.max }, secret, now)) throw new InputError("Subida no autorizada o vencida.", 403);

  const [dup] = await db.query(`SELECT 1 FROM client_files WHERE blob_pathname = $1`, [pathname]);
  if (dup) throw new InputError("Este archivo ya fue registrado.", 409); // never delete: it belongs to the first call

  const reject = async (message, status = 400) => {
    await storage.remove(pathname).catch((e) => log(`[files] orphan blob ${pathname}: ${e.message}`));
    return new InputError(message, status);
  };

  const blob = await storage.inspect(pathname);
  if (!blob) throw new InputError("No se encontró el archivo subido. Probá de nuevo.", 400);
  if (blob.size <= 0 || blob.size > type.max) throw await reject("El archivo está vacío o supera el tamaño máximo.");
  const sniffed = sniffMime(blob.head);
  if (sniffed !== type.mime) throw await reject("El contenido del archivo no coincide con su extensión.");

  const name = cleanText(input.name, 120);
  const originalName = String(input.originalName ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "archivo";
  const description = input.description ? cleanText(input.description, 1000) : null;
  if (!name) throw await reject("Ingresá un nombre para el archivo.");
  if (input.description && !description) throw await reject("La descripción es demasiado larga.");

  try {
    return await db.tx(async (t) => {
      await clientExists(t, clientId);
      const contentId = await checkContent(t, clientId, input.contentId || null);
      let base = null;
      if (input.newVersionOf) {
        [base] = await t.query(`SELECT id, group_key FROM client_files WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL`, [input.newVersionOf, clientId]);
        if (!base) throw new InputError("El archivo base no existe.", 404);
      }
      const id = newId("fil");
      const groupKey = base ? base.group_key : id;
      await lockGroup(t, groupKey); // serialises concurrent versions of the same group
      const [{ v }] = await t.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM client_files WHERE group_key = $1`, [groupKey]);
      if (input.markFinal) await t.query(`UPDATE client_files SET is_final = false WHERE group_key = $1 AND is_final`, [groupKey]);
      await t.query(
        `INSERT INTO client_files (id, client_id, content_id, category, name, original_name, blob_pathname, mime, size, version,
                                   group_key, is_final, client_visible, description, uploaded_by_type, uploaded_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'studio','Stroka')`,
        [id, clientId, contentId, category, name, originalName, pathname, type.mime, blob.size, v, groupKey,
         Boolean(input.markFinal), input.clientVisible !== false, description]
      );
      const data = { fileId: id, name, version: v, category, size: blob.size };
      await logActivity(t, { clientId, contentId, ...ACTOR, event: v > 1 ? "file.version_added" : "file.uploaded", data, clientVisible: false });
      if (input.markFinal) await logActivity(t, { clientId, contentId, ...ACTOR, event: "file.marked_final", data });
      return { id, version: v, groupKey };
    });
  } catch (err) {
    if (err?.code === "23505" && String(err.constraint || err.message).includes("blob_pathname")) {
      throw new InputError("Este archivo ya fue registrado.", 409); // concurrent double-complete: keep the blob
    }
    await storage.remove(pathname).catch((e) => log(`[files] orphan blob ${pathname}: ${e.message}`));
    throw err;
  }
}

export async function setFinal(db, fileId, value = true) {
  return db.tx(async (t) => {
    const [f] = await t.query(`SELECT id, client_id, content_id, group_key, name, version FROM client_files WHERE id = $1 AND deleted_at IS NULL`, [fileId]);
    if (!f) throw new InputError("Archivo no encontrado.", 404);
    await lockGroup(t, f.group_key);
    await t.query(`UPDATE client_files SET is_final = false WHERE group_key = $1 AND is_final`, [f.group_key]);
    if (value) await t.query(`UPDATE client_files SET is_final = true WHERE id = $1`, [fileId]);
    if (value) {
      await logActivity(t, { clientId: f.client_id, contentId: f.content_id, ...ACTOR, event: "file.marked_final", data: { fileId, name: f.name, version: f.version } });
    }
    return { final: Boolean(value) };
  });
}

export async function archiveFile(db, fileId) {
  return db.tx(async (t) => {
    const [f] = await t.query(
      `UPDATE client_files SET deleted_at = now(), deleted_by = 'Stroka', is_final = false
        WHERE id = $1 AND deleted_at IS NULL RETURNING client_id, content_id, name, version, category`,
      [fileId]
    );
    if (!f) throw new InputError("Archivo no encontrado o ya archivado.", 404);
    await logActivity(t, { clientId: f.client_id, contentId: f.content_id, ...ACTOR, event: "file.archived", data: { fileId, name: f.name, version: f.version } });
    return { archived: true };
  });
}

export async function setVisibility(db, fileId, visible) {
  const rows = await db.query(`UPDATE client_files SET client_visible = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id`, [fileId, Boolean(visible)]);
  if (!rows.length) throw new InputError("Archivo no encontrado.", 404);
  return { visible: Boolean(visible) };
}

const cols = `f.id, f.client_id, f.content_id, f.category, f.name, f.original_name, f.mime, f.size, f.version, f.group_key,
              f.is_final, f.client_visible, f.description, f.created_at, f.deleted_at, i.title AS content_title`;

export async function listClientFiles(db, clientId) {
  return db.query(
    `SELECT ${cols} FROM client_files f LEFT JOIN content_items i ON i.id = f.content_id AND i.client_id = f.client_id
      WHERE f.client_id = $1 AND f.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 500`,
    [clientId]
  );
}

// For Studio downloads (any client). Includes the pathname: server-side only.
export async function getFileForAdmin(db, fileId) {
  const [f] = await db.query(`SELECT id, client_id, name, original_name, blob_pathname, mime, size, deleted_at FROM client_files WHERE id = $1`, [fileId]);
  return f || null;
}

// Manual maintenance: removes the BYTES of files archived more than N days ago.
// Rows stay (audit); `purged_at` marks them. Dry-run unless told otherwise.
export async function purgeArchived(db, storage, { olderThanDays = 30, dryRun = true, confirm, log = console.error } = {}) {
  const rows = await db.query(
    `SELECT id, blob_pathname FROM client_files
      WHERE deleted_at IS NOT NULL AND purged_at IS NULL AND deleted_at < now() - ($1::int * interval '1 day')`,
    [olderThanDays]
  );
  if (dryRun) return { candidates: rows.length, purged: 0 };
  if (confirm !== rows.length) throw new InputError(`Confirmación inválida: hay ${rows.length} candidatos y se pasó ${confirm}.`);
  let purged = 0;
  for (const r of rows) {
    try {
      await storage.remove(r.blob_pathname);
      // Consistent read (useCache:false): a cached read must not decide this.
      if (await storage.exists(r.blob_pathname)) throw new Error("el blob sigue existiendo tras borrarlo");
      await db.query(`UPDATE client_files SET purged_at = now() WHERE id = $1`, [r.id]);
      purged++;
    } catch (e) {
      log(`[files] no se pudo purgar ${r.blob_pathname}: ${e.message}`);
    }
  }
  return { candidates: rows.length, purged };
}

// ---- Maintenance (manual; no cron) ---------------------------------------
// Orphan blob = bytes in the store with no row in client_files (an interrupted
// upload, or a compensation delete that failed). Rows of archived/purged files
// still "own" their pathname, so they are never reported. `minAgeMinutes`
// protects uploads that finished but have not been registered yet.
// DRY RUN by default: lists pathname, age and size and deletes nothing.
export async function scanOrphanBlobs(db, storage, { minAgeMinutes = 60, now = Date.now() } = {}) {
  const known = new Set((await db.query(`SELECT blob_pathname FROM client_files`)).map((r) => r.blob_pathname));
  const blobs = await storage.list("clients/");
  const orphans = blobs
    .filter((b) => !known.has(b.pathname))
    .map((b) => ({ pathname: b.pathname, size: b.size, ageMinutes: Math.floor((now - new Date(b.uploadedAt).getTime()) / 60000) }))
    .filter((b) => b.ageMinutes >= minAgeMinutes)
    .sort((a, b) => b.ageMinutes - a.ageMinutes);
  return { scanned: blobs.length, orphans };
}

// Deletes exactly the orphans a scan found, and ONLY if `confirm` equals their
// count (so the caller must have looked at the dry run). Re-scans first.
export async function removeOrphanBlobs(db, storage, { minAgeMinutes = 60, confirm, now = Date.now(), log = console.error } = {}) {
  const { orphans } = await scanOrphanBlobs(db, storage, { minAgeMinutes, now });
  if (confirm !== orphans.length) throw new InputError(`Confirmación inválida: hay ${orphans.length} huérfanos y se pasó ${confirm}.`);
  let removed = 0;
  for (const o of orphans) {
    try {
      await storage.remove(o.pathname);
      if (await storage.exists(o.pathname)) throw new Error("el blob sigue existiendo tras borrarlo");
      removed++;
    } catch (e) { log(`[files] no se pudo borrar ${o.pathname}: ${e.message}`); }
  }
  return { removed };
}
