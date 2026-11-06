// Storage adapters for client files. Same tiny interface everywhere:
//
//   inspect(pathname) → null | { size, head: Uint8Array }   (first bytes, for sniffing)
//   open(pathname)    → null | { stream, size, contentType } (to stream to the browser)
//   remove(pathname)  → void  (idempotent)
//   exists(pathname)  → boolean  (CONSISTENT read, no CDN cache: confirms a deletion)
//   list(prefix)      → [{ pathname, size, uploadedAt }]  (maintenance scans)
//   presignGet(pathname, { ttlSeconds, download })  → URL   (blob only)
//       A signed GET URL scoped to ONE pathname, expiring, carrying no store
//       credential. Downloads are answered with a redirect to it, so the bytes
//       never cross our Function. The "fs" adapter has none: the dev route streams.
//
// "blob": a PRIVATE Vercel Blob store, addressed with its own explicit token
//         (never BLOB_READ_WRITE_TOKEN, which belongs to the public store).
// "fs":   a local directory — development and tests only (never in production).
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { KIND_BY_MIME, SIGNED_URL_TTL_SECONDS, SNIFF_BYTES } from "./rules.js";

async function readFirst(stream, n) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < n) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(total, n));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - off);
    out.set(c.subarray(0, take), off);
    off += take;
    if (off >= out.length) break;
  }
  return out;
}

export function createBlobStorage({ token, sdk }) {
  if (!token) throw new Error("Falta el token del store privado de archivos.");
  const load = async () => sdk || (await import("@vercel/blob"));
  const get = async (pathname) => {
    const { get: sdkGet } = await load();
    return sdkGet(pathname, { access: "private", token });
  };
  return {
    mode: "blob",
    async inspect(pathname) {
      const r = await get(pathname);
      if (!r || !r.stream) return null;
      return { size: r.blob.size, head: await readFirst(r.stream, SNIFF_BYTES) };
    },
    async open(pathname) {
      const r = await get(pathname);
      if (!r || !r.stream) return null;
      return { stream: r.stream, size: r.blob.size, contentType: r.blob.contentType };
    },
    async remove(pathname) {
      const { del } = await load();
      await del(pathname, { token });
    },
    // Consistent read (bypasses the CDN cache, which can keep serving a blob for
    // ~60 s after del()). Use it to CONFIRM a physical deletion; never for downloads.
    async exists(pathname) {
      const { get: sdkGet } = await load();
      const r = await sdkGet(pathname, { access: "private", token, useCache: false });
      return !!r && r.statusCode !== 404;
    },
    async list(prefix = "") {
      const { list } = await load();
      const out = [];
      let cursor;
      do {
        const r = await list({ prefix, cursor, limit: 1000, token });
        for (const b of r.blobs) out.push({ pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt) });
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
    async presignGet(pathname, { ttlSeconds = SIGNED_URL_TTL_SECONDS, download = false, now = Date.now() } = {}) {
      const { issueSignedToken, presignUrl } = await load();
      const validUntil = now + ttlSeconds * 1000;
      // Delegation limited to GET on this pathname; the store token never leaves the server.
      const signed = await issueSignedToken({ token, pathname, operations: ["get"], validUntil });
      const { presignedUrl } = await presignUrl(signed, { access: "private", operation: "get", pathname, validUntil });
      if (!download) return presignedUrl;
      const u = new URL(presignedUrl);
      u.searchParams.set("download", "1");
      return u.toString();
    },
  };
}

export function createFsStorage(root) {
  const base = resolve(root);
  const file = (pathname) => {
    const p = resolve(join(base, pathname));
    if (!p.startsWith(base + sep)) throw new Error("pathname fuera del directorio de archivos");
    return p;
  };
  return {
    mode: "fs",
    // dev/test helper (the Blob adapter has no equivalent: browsers upload directly)
    async put(pathname, bytes) {
      const p = file(pathname);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
    },
    async inspect(pathname) {
      try {
        const st = await stat(file(pathname));
        const buf = await readFile(file(pathname));
        return { size: st.size, head: new Uint8Array(buf.subarray(0, SNIFF_BYTES)) };
      } catch {
        return null;
      }
    },
    async open(pathname) {
      try {
        const p = file(pathname);
        const st = await stat(p);
        return { stream: Readable.toWeb(createReadStream(p)), size: st.size, contentType: null };
      } catch {
        return null;
      }
    },
    async remove(pathname) {
      await rm(file(pathname), { force: true });
    },
    async exists(pathname) {
      try { await stat(file(pathname)); return true; } catch { return false; }
    },
    async list(prefix = "") {
      const out = [];
      const walk = async (dir) => {
        let entries;
        try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else {
            const st = await stat(full);
            const pathname = full.slice(base.length + 1).split(sep).join("/");
            if (pathname.startsWith(prefix)) out.push({ pathname, size: st.size, uploadedAt: st.mtime });
          }
        }
      };
      await walk(base);
      return out;
    },
  };
}

export { KIND_BY_MIME };
