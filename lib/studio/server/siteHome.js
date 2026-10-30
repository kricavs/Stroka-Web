import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_WORK, clampFocal, clampZoom } from "../../home-shared";
import { BLOB_HOST } from "./blob";
import { getDb } from "./db";

const imageRow = (r) => ({ id: r.id, url: r.url, pathname: r.blob_pathname, width: r.width, height: r.height });
const slotRow = (r) => ({
  slot: r.slot,
  projectSlug: r.project_slug,
  imageId: r.image_id,
  sortOrder: r.sort_order,
  focalX: r.focal_x,
  focalY: r.focal_y,
  zoom: r.zoom,
  image: r.url ? { url: r.url, width: r.width, height: r.height } : null,
});

export async function listImages() {
  const db = await getDb();
  return (await db.query(`SELECT * FROM site_images ORDER BY created_at DESC LIMIT 200`)).map(imageRow);
}

export async function createImage({ url, pathname, width, height }) {
  let host = "";
  try {
    const u = new URL(url);
    if (u.protocol === "https:") host = u.hostname;
  } catch {}
  if (!BLOB_HOST.test(host)) return null;
  const dim = (n) => (Number.isInteger(n) && n > 0 && n < 100000 ? n : null);
  const db = await getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO site_images (id, url, blob_pathname, width, height) VALUES ($1,$2,$3,$4,$5)`,
    [id, url, typeof pathname === "string" ? pathname.slice(0, 300) : null, dim(width), dim(height)]
  );
  return { id, url, pathname: pathname || null, width: dim(width), height: dim(height) };
}

// Returns { status: "ok" | "missing" | "in-use", image }.
export async function deleteImage(id) {
  const db = await getDb();
  const [img] = await db.query(`SELECT * FROM site_images WHERE id = $1`, [String(id)]);
  if (!img) return { status: "missing" };
  const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM site_home_slots WHERE image_id = $1`, [img.id]);
  if (n > 0) return { status: "in-use" };
  await db.query(`DELETE FROM site_images WHERE id = $1`, [img.id]);
  return { status: "ok", image: imageRow(img) };
}

export async function getHomeSlots() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, i.url, i.width, i.height FROM site_home_slots s
     LEFT JOIN site_images i ON i.id = s.image_id
     ORDER BY s.sort_order, s.updated_at`
  );
  const slots = rows.map(slotRow);
  return {
    hero: slots.find((s) => s.slot === "hero") || null,
    contact: slots.find((s) => s.slot === "contact") || null,
    work: slots.filter((s) => s.slot === "work").slice(0, MAX_WORK),
  };
}

// Validates the payload from Studio. `knownSlugs` are the real portfolio projects.
export async function saveHomeSlots(input, knownSlugs) {
  const db = await getDb();
  const ids = new Set((await db.query(`SELECT id FROM site_images`)).map((r) => r.id));
  const errors = [];

  const crop = (o) => ({ focalX: clampFocal(o?.focalX), focalY: clampFocal(o?.focalY), zoom: clampZoom(o?.zoom) });
  const single = (o, label) => {
    if (!o || !o.imageId) return null;
    if (!ids.has(o.imageId)) errors.push(`${label}: la imagen elegida ya no existe.`);
    return { imageId: String(o.imageId), ...crop(o) };
  };

  const hero = single(input?.hero, "Hero");
  const contact = single(input?.contact, "Contacto");
  const workIn = Array.isArray(input?.work) ? input.work : [];
  if (workIn.length > MAX_WORK) errors.push(`Máximo ${MAX_WORK} proyectos en Selected Work.`);
  const seen = new Set();
  const work = workIn.slice(0, MAX_WORK).map((w) => {
    const slug = String(w?.projectSlug || "");
    if (!knownSlugs.includes(slug)) errors.push(`Proyecto inexistente: "${slug}".`);
    if (seen.has(slug)) errors.push(`Proyecto repetido: "${slug}".`);
    seen.add(slug);
    if (w?.imageId && !ids.has(w.imageId)) errors.push(`Proyecto ${slug}: la imagen elegida ya no existe.`);
    return { projectSlug: slug, imageId: w?.imageId ? String(w.imageId) : null, ...crop(w) };
  });
  if (errors.length) return { errors };

  const upsertSingle = async (slot, v) => {
    if (!v) return db.query(`DELETE FROM site_home_slots WHERE slot = $1`, [slot]);
    return db.query(
      `INSERT INTO site_home_slots (id, slot, image_id, focal_x, focal_y, zoom)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slot) WHERE slot <> 'work'
       DO UPDATE SET image_id=$3, focal_x=$4, focal_y=$5, zoom=$6, updated_at=now()`,
      [randomUUID(), slot, v.imageId, v.focalX, v.focalY, v.zoom]
    );
  };
  await upsertSingle("hero", hero);
  await upsertSingle("contact", contact);

  await db.query(`DELETE FROM site_home_slots WHERE slot = 'work' AND NOT (project_slug = ANY($1::text[]))`, [
    work.map((w) => w.projectSlug),
  ]);
  for (const [i, w] of work.entries()) {
    await db.query(
      `INSERT INTO site_home_slots (id, slot, project_slug, image_id, sort_order, focal_x, focal_y, zoom)
       VALUES ($1,'work',$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_slug) WHERE slot = 'work'
       DO UPDATE SET image_id=$3, sort_order=$4, focal_x=$5, focal_y=$6, zoom=$7, updated_at=now()`,
      [randomUUID(), w.projectSlug, w.imageId, i, w.focalX, w.focalY, w.zoom]
    );
  }
  return { errors: [] };
}
