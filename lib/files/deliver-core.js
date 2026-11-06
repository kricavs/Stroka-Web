// How a file reaches the browser.
//
//  - Production path (storage has presignGet): 302 to a SIGNED GET URL valid ~5
//    minutes, scoped to this one pathname, carrying no store credential. The
//    bytes go store → browser; our Function only authorises and redirects. The
//    URL is never stored (not in the DB, not in activity_log).
//  - Development path (local filesystem store): the route streams the bytes.
//
// Authorisation (session, ClientScope, client_id, visibility, deleted_at,
// related content) happens BEFORE this is called.
import { INLINE_KINDS, KIND_BY_MIME, SIGNED_URL_TTL_SECONDS, contentDisposition, extOf } from "./rules.js";

const labelOf = (file) => {
  const ext = extOf(file.blob_pathname);
  return file.name.toLowerCase().endsWith(`.${ext}`) ? file.name : `${file.name}.${ext}`;
};

export async function streamFile({ file, storage, inline }) {
  const obj = await storage.open(file.blob_pathname);
  if (!obj) return Response.json({ error: "No encontrado" }, { status: 404 });
  const kind = KIND_BY_MIME[file.mime];
  const showInline = inline && INLINE_KINDS.includes(kind);
  const headers = {
    "Content-Type": file.mime,
    "Content-Disposition": contentDisposition(showInline ? "inline" : "attachment", labelOf(file)),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
  if (obj.size) headers["Content-Length"] = String(obj.size);
  if (kind === "image") headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
  return new Response(obj.stream, { status: 200, headers });
}

export async function deliverFile({ file, storage, inline = false, ttlSeconds = SIGNED_URL_TTL_SECONDS }) {
  if (typeof storage.presignGet !== "function") return streamFile({ file, storage, inline });
  const kind = KIND_BY_MIME[file.mime];
  const showInline = inline && INLINE_KINDS.includes(kind);
  const url = await storage.presignGet(file.blob_pathname, { ttlSeconds, download: !showInline });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "private, no-store", // a cached redirect would outlive its URL
      "Referrer-Policy": "no-referrer",
    },
  });
}
