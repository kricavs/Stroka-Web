import { InputError } from "@/lib/studio/errors.js";
import { MAX_XLSX_BYTES, MB } from "@/lib/planner/limits.js";
import { importWorkbook } from "@/lib/studio/server/planner-import";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Step 1: upload + analyze → a DRAFT. Nothing is written to the calendar.
export const POST = (req, { params }) =>
  studioRoute(async () => {
    // refuse oversized bodies before buffering them (Vercel itself caps bodies near 4.5 MB)
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_XLSX_BYTES + MB) throw new InputError(`El archivo supera el máximo de ${MAX_XLSX_BYTES / MB} MB.`, 413);
    const form = await req.formData().catch(() => null);
    if (!form) throw new InputError("No se pudo leer el formulario.");
    const out = await importWorkbook({
      clientId: params.id,
      file: form.get("file"),
      platform: String(form.get("platform") || ""),
      status: String(form.get("status") || ""),
      time: String(form.get("time") || ""),
    });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  });
