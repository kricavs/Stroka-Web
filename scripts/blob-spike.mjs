#!/usr/bin/env node
// Technical spike against the PRIVATE Preview store (stroka-client-files-preview).
// Verifies, with the real service, what the design relies on: private uploads,
// signed GET URLs, expiry, Range, inline vs download, scoping and cleanup.
//
//   read -s CLIENT_FILES_READ_WRITE_TOKEN && export CLIENT_FILES_READ_WRITE_TOKEN
//   node scripts/blob-spike.mjs
//
// Guard: refuses to run unless the token belongs to the Preview private store.
// Output never contains the token or any signature value. All test blobs live
// under spike/<run id>/ and are deleted at the end.
import { createHash, randomBytes } from "node:crypto";
import { del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken, put as clientPut } from "@vercel/blob/client";

const EXPECTED_STORE = "xsesjj6nix406nxq"; // store_xSesjJ6Nix406nXQ (stroka-client-files-preview)
const token = process.env.CLIENT_FILES_READ_WRITE_TOKEN;
if (!token) { console.error("Falta CLIENT_FILES_READ_WRITE_TOKEN."); process.exit(2); }
const storeId = (token.split("_")[3] || "").toLowerCase();
if (storeId !== EXPECTED_STORE) { console.error("El token NO es del store privado de Preview. Abortado."); process.exit(2); }

const run = `spike/${Date.now().toString(36)}`;
const out = [];
const log = (k, v) => { out.push([k, v]); console.log(`• ${k}:`, typeof v === "string" ? v : JSON.stringify(v)); };
const step = async (name, fn) => { try { await fn(); } catch (e) { log(`${name} ERROR`, `${e.name}: ${e.message}`.slice(0, 300)); } };
const redact = (u) => { const x = new URL(u); return `${x.host}${x.pathname} [params: ${[...x.searchParams.keys()].join(",")}]`; };
const hdrs = (r, names) => Object.fromEntries(names.map((n) => [n, r.headers.get(n)]));
const SHOW = ["content-type", "content-disposition", "content-length", "content-range", "accept-ranges", "cache-control", "x-content-type-options", "content-security-policy", "etag"];

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(2048)]);
const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(2 * 1024 * 1024), Buffer.from("\n%%EOF\n")]);
const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), randomBytes(40 * 1024 * 1024)]);
const files = {
  png: { path: `${run}/logo.png`, body: png, type: "image/png" },
  pdf: { path: `${run}/entrega.pdf`, body: pdf, type: "application/pdf" },
  zip: { path: `${run}/pack.zip`, body: zip, type: "application/zip" },
};
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

async function sign(pathname, ttlMs = 300_000) {
  const validUntil = Date.now() + ttlMs;
  const t = await issueSignedToken({ token, pathname, operations: ["get"], validUntil });
  return (await presignUrl(t, { access: "private", operation: "get", pathname, validUntil })).presignedUrl;
}

log("store (de la forma del token)", storeId);

// 1. Server-side put (private)
for (const [k, f] of Object.entries(files)) {
  await step(`put ${k}`, async () => {
    const t0 = Date.now();
    const r = await put(f.path, f.body, { access: "private", token, contentType: f.type, addRandomSuffix: false, allowOverwrite: false, multipart: f.body.length > 20 * 1024 * 1024 });
    log(`put ${k}`, { ms: Date.now() - t0, urlHost: new URL(r.url).host, contentType: r.contentType, contentDisposition: r.contentDisposition });
  });
}

// 2. Direct (client-token) upload, the path the browser uses
await step("client token upload", async () => {
  const pathname = `${run}/directo.pdf`;
  const clientToken = await generateClientTokenFromReadWriteToken({ token, pathname, allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 600_000 });
  const ok = await clientPut(pathname, pdf, { access: "private", token: clientToken, contentType: "application/pdf", multipart: true });
  log("client upload (multipart, pdf 2MB, token acotado)", { ok: true, contentType: ok.contentType });
  files.direct = { path: pathname, body: pdf, type: "application/pdf" };
  await clientPut(`${run}/mal-tipo.png`, png, { access: "private", token: await generateClientTokenFromReadWriteToken({ token, pathname: `${run}/mal-tipo.png`, allowedContentTypes: ["application/pdf"], validUntil: Date.now() + 600_000 }), contentType: "image/png" })
    .then(() => log("client upload con contentType NO permitido", "ACEPTADO (inesperado)"), (e) => log("client upload con contentType NO permitido", `rechazado: ${e.name}`));
  await clientPut(`${run}/grande.pdf`, pdf, { access: "private", token: await generateClientTokenFromReadWriteToken({ token, pathname: `${run}/grande.pdf`, allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 1024, validUntil: Date.now() + 600_000 }), contentType: "application/pdf" })
    .then(() => log("client upload sobre maximumSizeInBytes", "ACEPTADO (inesperado)"), (e) => log("client upload sobre maximumSizeInBytes", `rechazado: ${e.name}`));
});

// 3. Metadata as stored
await step("get metadata", async () => {
  const r = await get(files.png.path, { access: "private", token });
  log("get() metadata png", { size: r.blob.size, contentType: r.blob.contentType, contentDisposition: r.blob.contentDisposition, cacheControl: r.blob.cacheControl });
  await r.stream.cancel();
});

// 4. Signed GET: no credentials, headers, inline vs download
for (const k of ["png", "pdf", "zip"]) {
  await step(`signed ${k}`, async () => {
    const f = files[k];
    const url = await sign(f.path);
    const t0 = Date.now();
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    log(`signed GET ${k}`, { url: redact(url), status: r.status, ms: Date.now() - t0, bytes: buf.length, sameBytes: sha(buf) === sha(f.body), headers: hdrs(r, SHOW) });
    const d = await fetch(`${url}&download=1`, { method: "GET" });
    await d.body?.cancel();
    log(`signed GET ${k} +download=1`, { status: d.status, disposition: d.headers.get("content-disposition") });
  });
}

// 5. Range requests
await step("range", async () => {
  for (const [k, ranges] of [["pdf", ["bytes=0-1023", "bytes=1048576-1049599", "bytes=-512"]], ["zip", ["bytes=0-1023", "bytes=20971520-20972543"]], ["png", ["bytes=0-99"]]]) {
    const url = await sign(files[k].path);
    for (const range of ranges) {
      const t0 = Date.now();
      const r = await fetch(url, { headers: { Range: range } });
      const buf = Buffer.from(await r.arrayBuffer());
      log(`Range ${k} ${range}`, { status: r.status, ms: Date.now() - t0, receivedBytes: buf.length, contentRange: r.headers.get("content-range"), acceptRanges: r.headers.get("accept-ranges"), contentLength: r.headers.get("content-length") });
    }
  }
});

// 6. Expiry
await step("expiry", async () => {
  const url = await sign(files.png.path, 4000);
  const a = await fetch(url); await a.arrayBuffer();
  await new Promise((r) => setTimeout(r, 7000));
  const b = await fetch(url); await b.arrayBuffer();
  log("expiración (ttl 4 s)", { antes: a.status, despuesDe7s: b.status });
});

// 7. Scoping / tampering
await step("scoping", async () => {
  const url = await sign(files.png.path);
  const u = new URL(url);
  const other = new URL(url); other.pathname = `/${files.pdf.path}`;
  const r1 = await fetch(other); await r1.arrayBuffer();
  const unsigned = new URL(url); unsigned.search = "";
  const r2 = await fetch(unsigned); await r2.arrayBuffer();
  const noSig = new URL(url); for (const k of [...noSig.searchParams.keys()]) if (/sig|signature/i.test(k)) noSig.searchParams.delete(k);
  const r3 = await fetch(noSig); await r3.arrayBuffer();
  const head = await fetch(url, { method: "HEAD" });
  const put2 = await fetch(url, { method: "PUT", body: "x" }); await put2.arrayBuffer();
  const del2 = await fetch(url, { method: "DELETE" }); await del2.arrayBuffer();
  log("URL de A usada para el pathname de B", r1.status);
  log("URL sin query (sin firma)", r2.status);
  log("URL sin parámetro de firma", { status: r3.status, params: [...u.searchParams.keys()] });
  log("HEAD con URL firmada para GET", head.status);
  log("PUT con URL firmada para GET", put2.status);
  log("DELETE con URL firmada para GET", del2.status);
  const r4 = await fetch(`https://${new URL(url).host}/${files.png.path}`); await r4.arrayBuffer();
  log("raw URL del blob sin firma", r4.status);
});

// 8. list on a private store
await step("list", async () => {
  const r = await list({ prefix: run, token });
  log("list(prefix) en store privado", { count: r.blobs.length, hasMore: r.hasMore });
});

// 9. Cleanup
await step("cleanup", async () => {
  const r = await list({ prefix: run, token });
  await del(r.blobs.map((b) => b.pathname), { token });
  const after = await list({ prefix: run, token });
  log("limpieza", { borrados: r.blobs.length, restantes: after.blobs.length });
  // Normal read may be served from the CDN cache for ~60 s after del(): informative only.
  const cached = await get(files.png.path, { access: "private", token });
  log("get() normal (cacheado) tras del()", cached === null ? "null (404)" : "AÚN EXISTE (caché CDN, esperado ≤60 s)");
  // Consistent read: this one decides whether the blob is really gone.
  const fresh = await get(files.png.path, { access: "private", token, useCache: false });
  log("get() consistente (useCache:false) tras del()", fresh === null ? "OK: ya no existe" : "FALLO: el blob sigue existiendo");
});
console.log("\nListo. Ningún secreto ni valor de firma fue impreso.");
