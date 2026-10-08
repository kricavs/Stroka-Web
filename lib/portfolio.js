// Local portfolio data source (server only).
//
// Projects live in content/portfolio/proyectos/<slug>.json and their photos in
// public/portfolio/<categoria>/<slug>/. Nothing here talks to the network.
// Everything is validated while loading, so a typo or a missing file makes the
// build (or the dev server) fail with a message that names the offending file
// instead of silently showing empty or fake content.

import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "portfolio");
const PROJECTS_DIR = path.join(CONTENT_DIR, "proyectos");
const PUBLIC_DIR = path.join(ROOT, "public", "portfolio");

const IMAGE_EXT = /\.(webp|jpe?g|png|avif)$/i;
const FILE_NAME = /^[\w.-]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YOUTUBE_ID = /^[\w-]{11}$/;
const KNOWN_KEYS = [
  "example",
  "title",
  "client",
  "year",
  "category",
  "description",
  "services",
  "cover",
  "photos",
  "videos",
  "order",
];

function fail(file, message) {
  throw new Error(`[portfolio] ${file}: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail(path.relative(ROOT, file), `JSON inválido o ilegible (${err.message})`);
  }
}

export function getCategories() {
  const file = path.join(CONTENT_DIR, "categorias.json");
  const rel = path.relative(ROOT, file);
  const list = readJson(file);
  if (!Array.isArray(list) || list.length === 0) {
    fail(rel, "debe ser una lista con al menos una categoría");
  }
  const seen = new Set();
  for (const c of list) {
    if (!c || !SLUG.test(c.slug || "") || !c.title) {
      fail(rel, `cada categoría necesita "slug" (minúsculas y guiones) y "title": ${JSON.stringify(c)}`);
    }
    if (seen.has(c.slug)) fail(rel, `categoría repetida: "${c.slug}"`);
    seen.add(c.slug);
  }
  return list;
}

// Accepts an 11-character video ID or any common YouTube URL.
export function parseYouTubeId(value) {
  const v = String(value || "").trim();
  if (YOUTUBE_ID.test(v)) return v;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
        id = m && m[1];
      }
    }
    if (id && YOUTUBE_ID.test(id)) return id;
  } catch {
    // not a URL
  }
  return null;
}

function loadImage(rel, dir, publicBase, entry, label) {
  const { file, alt } = entry && typeof entry === "object" ? entry : {};
  if (!file || !FILE_NAME.test(file) || !IMAGE_EXT.test(file)) {
    fail(rel, `${label}: "file" debe ser un nombre de archivo .webp/.jpg/.png/.avif (recibido: ${JSON.stringify(file)})`);
  }
  if (!alt || typeof alt !== "string" || !alt.trim()) {
    fail(rel, `${label} (${file}): falta el texto alternativo "alt"`);
  }
  const abs = path.join(dir, file);
  if (!fs.existsSync(abs)) {
    fail(rel, `${label}: no existe public/${path.relative(path.join(ROOT, "public"), abs)}`);
  }
  let size;
  try {
    size = imageSize(fs.readFileSync(abs));
  } catch (err) {
    fail(rel, `${label} (${file}): no se pudo leer la imagen (${err.message})`);
  }
  return { src: `${publicBase}/${file}`, width: size.width, height: size.height, alt: alt.trim() };
}

function loadProject(fileName, categories) {
  const abs = path.join(PROJECTS_DIR, fileName);
  const rel = path.relative(ROOT, abs);
  const slug = fileName.replace(/\.json$/, "");
  if (!SLUG.test(slug)) {
    fail(rel, "el nombre del archivo es el slug de la URL: usá minúsculas, números y guiones (ej. kama-x1.json)");
  }
  const raw = readJson(abs);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(rel, "debe ser un objeto JSON");

  const unknown = Object.keys(raw).filter((k) => !KNOWN_KEYS.includes(k));
  if (unknown.length) {
    fail(rel, `campos desconocidos: ${unknown.join(", ")}. Permitidos: ${KNOWN_KEYS.join(", ")}`);
  }

  if (!raw.title || typeof raw.title !== "string") fail(rel, 'falta "title"');
  const category = categories.find((c) => c.slug === raw.category);
  if (!category) {
    fail(rel, `categoría "${raw.category}" inexistente. Disponibles: ${categories.map((c) => c.slug).join(", ")}`);
  }
  if (raw.year != null && !Number.isInteger(raw.year)) fail(rel, '"year" debe ser un número (ej. 2025)');
  if (raw.client != null && typeof raw.client !== "string") fail(rel, '"client" debe ser texto');
  if (raw.services != null && !(Array.isArray(raw.services) && raw.services.every((s) => typeof s === "string" && s.trim()))) {
    fail(rel, '"services" debe ser una lista de textos');
  }
  const description = [].concat(raw.description ?? []);
  if (!description.every((p) => typeof p === "string" && p.trim())) {
    fail(rel, '"description" debe ser un texto o una lista de párrafos');
  }

  const dir = path.join(PUBLIC_DIR, category.slug, slug);
  const publicBase = `/portfolio/${category.slug}/${slug}`;
  if (!fs.existsSync(dir)) fail(rel, `falta la carpeta de fotos public/portfolio/${category.slug}/${slug}/`);

  const cover = loadImage(rel, dir, publicBase, raw.cover, "cover");
  const photoList = raw.photos ?? [];
  if (!Array.isArray(photoList)) fail(rel, '"photos" debe ser una lista');
  const photos = photoList.map((p, i) => loadImage(rel, dir, publicBase, p, `photos[${i}]`));

  const videoList = raw.videos ?? [];
  if (!Array.isArray(videoList)) fail(rel, '"videos" debe ser una lista');
  const videos = videoList.map((v, i) => {
    const entry = typeof v === "string" ? { id: v } : v || {};
    const id = parseYouTubeId(entry.id ?? entry.url);
    if (!id) fail(rel, `videos[${i}]: ID o URL de YouTube inválido (${JSON.stringify(v)})`);
    return { id, title: (entry.title || `${raw.title} — video ${i + 1}`).trim() };
  });

  // Photos on disk that no project entry uses are usually a forgotten line.
  const used = new Set([raw.cover?.file, ...photoList.map((p) => p?.file)]);
  const unused = fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f) && !used.has(f));
  if (unused.length) {
    warnOnce(`${slug}-unused`, `${rel}: imágenes en la carpeta que el proyecto no usa: ${unused.join(", ")}`);
  }

  return {
    slug,
    title: raw.title.trim(),
    client: raw.client?.trim() || null,
    year: raw.year ?? null,
    category: { slug: category.slug, title: category.title },
    description,
    services: raw.services ?? [],
    cover,
    photos,
    videos,
    example: raw.example === true,
    order: Number.isFinite(raw.order) ? raw.order : null,
  };
}

const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[portfolio] ${message}`);
}

// All projects, sorted: explicit "order" first, then newest year, then title.
export function getProjects() {
  const categories = getCategories();
  if (!fs.existsSync(PROJECTS_DIR)) fail(path.relative(ROOT, PROJECTS_DIR), "no existe la carpeta de proyectos");
  const projects = fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadProject(f, categories));

  const examples = projects.filter((p) => p.example);
  if (examples.length) {
    warnOnce(
      "examples",
      `${examples.length} proyecto(s) de ejemplo publicados (campo "example": true): ${examples
        .map((p) => p.slug)
        .join(", ")}. Reemplazalos o borralos antes de lanzar.`
    );
  }

  return projects.sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      (b.year ?? 0) - (a.year ?? 0) ||
      a.title.localeCompare(b.title, "es")
  );
}

export function getProject(slug) {
  return getProjects().find((p) => p.slug === slug) || null;
}

export function getProjectsByCategory(slug) {
  return getProjects().filter((p) => p.category.slug === slug);
}

// Categories that actually have projects (used for the filter bar).
export function getUsedCategories() {
  const used = new Set(getProjects().map((p) => p.category.slug));
  return getCategories().filter((c) => used.has(c.slug));
}
