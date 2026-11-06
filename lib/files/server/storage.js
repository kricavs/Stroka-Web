import "server-only";
import { createBlobStorage, createFsStorage } from "../storage-core.js";

// Client files live in a PRIVATE Vercel Blob store with its OWN token. The public
// store's BLOB_READ_WRITE_TOKEN is never used here (and vice versa), so a
// mistake can't put a private file in the public store.
//
// Why an explicit read-write token and not OIDC (decision, 2026-11):
//  - The project has two Blob stores. Connecting the private one with the env
//    prefix CLIENT_FILES creates ONLY CLIENT_FILES_READ_WRITE_TOKEN: there is no
//    CLIENT_FILES_STORE_ID, and the unprefixed BLOB_STORE_ID / VERCEL_OIDC_TOKEN
//    pair can only address one store, so OIDC would need the store id hard-wired
//    and an explicit oidcToken (which the SDK does not refresh).
//  - Direct browser uploads use handleUpload(), which "always requires a
//    read-write token; OIDC is not accepted".
//  - The token is stored as a Sensitive (write-only) variable, scoped per
//    environment: Preview has the Preview store's token, Production will have
//    the Production store's. Browsers never receive it: they get a client token
//    limited to one pathname/type/size, and downloads use signed GET URLs.
// Revisit when Vercel lets a prefixed connection carry its own store id for OIDC.
//
// Revocation (expected behavior, not an isolation failure):
//  - Archiving a file blocks new authorizations from Stroka immediately.
//  - A signed URL already issued stays valid until it expires (TTL:
//    SIGNED_URL_TTL_SECONDS = 120 s, see ../rules.js; same for Portal and Studio).
//  - After del(), the CDN may keep serving the blob for about 60 s.
//  - Admin checks after a delete (purge, orphan removal) use a consistent read,
//    get(..., { useCache: false }), via storage.exists(); normal downloads keep the cache.
export const TOKEN_ENV = "CLIENT_FILES_READ_WRITE_TOKEN";
export const privateBlobToken = () => process.env[TOKEN_ENV] || "";

// "blob" | "fs" (dev only, never production) | null (feature unavailable)
export function filesMode() {
  if (privateBlobToken()) return "blob";
  return process.env.NODE_ENV === "production" ? null : "fs";
}

const g = globalThis;
export function getStorage() {
  const mode = filesMode();
  if (!mode) return null;
  g.__clientFilesStorage ||= mode === "blob" ? createBlobStorage({ token: privateBlobToken() }) : createFsStorage("./.data/client-files");
  return g.__clientFilesStorage;
}
