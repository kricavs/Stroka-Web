import { guardApi } from "@/lib/studio/server/auth";
import { blobEnabled } from "@/lib/studio/server/blob";
import { createImage, listImages } from "@/lib/studio/server/siteHome";

export const runtime = "nodejs";

export async function GET() {
  const denied = await guardApi();
  if (denied) return denied;
  return Response.json({ images: await listImages(), uploadEnabled: blobEnabled() });
}

// Registers a file already uploaded to Blob.
export async function POST(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const image = await createImage(body || {});
  if (!image) return Response.json({ error: "URL de imagen no válida." }, { status: 400 });
  return Response.json({ image }, { status: 201 });
}
