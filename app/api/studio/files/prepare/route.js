import { filesMode } from "@/lib/files/server/storage";
import { prepareUpload } from "@/lib/studio/server/files";
import { InputError } from "@/lib/studio/errors.js";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Step 1 of an upload: validates the metadata and hands out the pathname + a
// signed intent. Writes nothing.
export const POST = (req) =>
  studioRoute(async () => {
    const mode = filesMode();
    if (!mode) throw new InputError("Los archivos no están disponibles: falta configurar el store privado.", 503);
    const b = await readJson(req);
    const out = await prepareUpload({
      clientId: String(b.clientId || ""),
      category: String(b.category || ""),
      filename: String(b.filename || ""),
      size: Number(b.size),
      contentId: b.contentId ? String(b.contentId) : null,
    });
    return Response.json({ ...out, mode }, { headers: { "Cache-Control": "no-store" } });
  });
