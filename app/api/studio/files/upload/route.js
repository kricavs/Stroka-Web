import { handleUpload } from "@vercel/blob/client";
import { authorizeUploadToken } from "@/lib/studio/server/files";
import { getPepper } from "@/lib/portal/access-code.js";
import { FILE_TYPES, extOf } from "@/lib/files/rules.js";
import { guardApi } from "@/lib/studio/server/auth";
import { privateBlobToken } from "@/lib/files/server/storage";

export const runtime = "nodejs";

// Issues the short-lived token for a DIRECT browser → private store upload.
// Studio session required; the pathname must be one we prepared (signed intent),
// so a logged-in admin can't write arbitrary paths either.
export async function POST(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const token = privateBlobToken();
  if (!token) return Response.json({ error: "Falta configurar el store privado de archivos." }, { status: 503 });
  try {
    const json = await handleUpload({
      token,
      body: await req.json(),
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const p = JSON.parse(clientPayload || "{}");
        const type = FILE_TYPES[extOf(pathname)];
        if (!type || !authorizeUploadToken({ pathname, intent: p.intent, clientId: p.clientId, category: p.category, maxBytes: type.max }, getPepper())) {
          throw new Error("Subida no autorizada");
        }
        return { allowedContentTypes: [type.mime], maximumSizeInBytes: type.max, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return Response.json(json);
  } catch {
    return Response.json({ error: "No se pudo iniciar la subida." }, { status: 400 });
  }
}
