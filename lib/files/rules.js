// File rules shared by Studio and Portal. Pure and browser-safe (no Node imports).
//
// Trust model: nothing the browser says is believed. The extension picks the
// candidate type, the BYTES (magic numbers) must agree with it, and the stored
// mime always comes from our table — never from the upload request.

export const MB = 1024 * 1024;

export const FILE_CATEGORIES = [
  ["brand_assets", "Identidad"],
  ["logos", "Logos"],
  ["photos", "Fotos"],
  ["videos", "Videos"],
  ["deliverables", "Entregables"],
  ["documents", "Documentos"],
  ["content", "Contenido"],
  ["other", "Otros"],
];
export const CATEGORY_LABEL = Object.fromEntries(FILE_CATEGORIES);
// Portal order: what the client came for first.
export const PORTAL_CATEGORY_ORDER = ["deliverables", "content", "documents", "videos", "photos", "logos", "brand_assets", "other"];

// ---- Limits & policy: change HERE, nothing else depends on the numbers -----
export const FILE_LIMITS = {
  image: 25 * MB,
  pdf: 50 * MB,
  archive: 100 * MB, // Vercel advises against >100 MB through private storage; raise only after re-testing
};
// Lifetime of the signed GET URL a download request is answered with.
export const SIGNED_URL_TTL_SECONDS = 120;

// Allowed types. No SVG (active content), no HTML, no executables, no video in
// the private store for now (videos go through preview_url links).
// The limit of a single upload is the one of its type.
export const FILE_TYPES = {
  jpg: { mime: "image/jpeg", kind: "image", max: FILE_LIMITS.image },
  jpeg: { mime: "image/jpeg", kind: "image", max: FILE_LIMITS.image },
  png: { mime: "image/png", kind: "image", max: FILE_LIMITS.image },
  webp: { mime: "image/webp", kind: "image", max: FILE_LIMITS.image },
  avif: { mime: "image/avif", kind: "image", max: FILE_LIMITS.image },
  pdf: { mime: "application/pdf", kind: "pdf", max: FILE_LIMITS.pdf },
  zip: { mime: "application/zip", kind: "archive", max: FILE_LIMITS.archive },
};
export const ALLOWED_EXTENSIONS = Object.keys(FILE_TYPES);
export const KIND_BY_MIME = Object.fromEntries(Object.values(FILE_TYPES).map((t) => [t.mime, t.kind]));
// Only these may render inline in the browser; everything else is a download.
export const INLINE_KINDS = ["image", "pdf"];

export const extOf = (filename) => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(filename ?? "").trim());
  return m ? m[1].toLowerCase() : "";
};

// Magic numbers of the first bytes. Returns the canonical mime or null.
export function sniffMime(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const at = (i, s) => s.every((v, k) => b[i + k] === v);
  const ascii = (i, s) => [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (b.length >= 12 && ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  if (b.length >= 5 && ascii(0, "%PDF-")) return "application/pdf";
  if (b.length >= 4 && at(0, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return null;
}

export const SNIFF_BYTES = 32;

// -> { ok:true, ext, type } | { ok:false, error }
export function checkFilename(filename, size) {
  const ext = extOf(filename);
  const type = FILE_TYPES[ext];
  if (!type) return { ok: false, error: "Tipo de archivo no permitido. Se aceptan JPG, PNG, WEBP, AVIF, PDF y ZIP." };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > type.max) return { ok: false, error: `El archivo supera el máximo de ${Math.round(type.max / MB)} MB para ${ext.toUpperCase()}.` };
  return { ok: true, ext, type };
}

// Display/storage-safe base name: ascii, [a-z0-9._-], no leading dots, short.
export function sanitizeBaseName(filename) {
  const noExt = String(filename ?? "").replace(/\.[A-Za-z0-9]{1,8}$/, "");
  const s = noExt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "archivo";
}

const ID_RE = /^[a-z0-9_]{1,64}$/;
const CATS = FILE_CATEGORIES.map(([k]) => k);

// clients/{clientId}/{category}/{uuid}-{sanitized-name}.{ext}
export function buildPathname({ clientId, category, uuid, filename, ext }) {
  if (!ID_RE.test(String(clientId))) throw new Error("clientId inválido");
  if (!CATS.includes(category)) throw new Error("categoría inválida");
  if (!/^[0-9a-f]{32}$/.test(uuid)) throw new Error("uuid inválido");
  return `clients/${clientId}/${category}/${uuid}-${sanitizeBaseName(filename)}.${ext}`;
}

export function isSafePathname(pathname, clientId, category) {
  if (typeof pathname !== "string" || pathname.length > 220) return false;
  if (!ID_RE.test(String(clientId)) || !CATS.includes(category)) return false; // before building the RegExp
  const re = new RegExp(`^clients/${clientId}/${category}/[0-9a-f]{32}-[a-z0-9._-]{1,70}\\.(${ALLOWED_EXTENSIONS.join("|")})$`);
  return re.test(pathname) && !pathname.includes("..");
}

export const formatBytes = (n) =>
  n >= MB ? `${(n / MB).toFixed(n >= 10 * MB ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Content-Disposition with an ASCII fallback plus RFC 5987 UTF-8 name.
export function contentDisposition(kind, name) {
  const safe = String(name || "archivo").replace(/[\r\n"\\]/g, "").slice(0, 150);
  const ascii = safe.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/[;%]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
