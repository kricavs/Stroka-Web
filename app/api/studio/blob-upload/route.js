import { handleUpload } from "@vercel/blob/client";
import { guardApi } from "@/lib/studio/server/auth";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES, blobEnabled } from "@/lib/studio/server/blob";

export const runtime = "nodejs";

// Issues short-lived client-upload tokens. Session required (also enforced by
// middleware). The browser then uploads straight to Vercel Blob.
export async function POST(req) {
  const denied = await guardApi();
  if (denied) return denied;
  if (!blobEnabled()) {
    return Response.json(
      { error: "Las subidas no están disponibles: falta configurar Vercel Blob (BLOB_READ_WRITE_TOKEN)." },
      { status: 503 }
    );
  }
  try {
    const json = await handleUpload({
      body: await req.json(),
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: UPLOAD_TYPES,
        maximumSizeInBytes: UPLOAD_MAX_BYTES,
        addRandomSuffix: true,
      }),
      // No upload-completed webhook: the client registers the file through
      // /api/studio/site/images (the webhook could not pass the session cookie).
    });
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: "No se pudo iniciar la subida." }, { status: 400 });
  }
}
