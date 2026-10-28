import "server-only";

// Vercel Blob is optional: without BLOB_READ_WRITE_TOKEN everything keeps
// working and Studio explains that uploads are unavailable.
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export async function deleteBlob(urlOrPathname) {
  if (!blobEnabled() || !urlOrPathname) return;
  const { del } = await import("@vercel/blob");
  await del(urlOrPathname);
}
