import { completeUpload } from "@/lib/studio/server/files";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Step 3: re-validates the stored bytes and only then writes the row.
export const POST = (req) =>
  studioRoute(async () => {
    const b = await readJson(req);
    const out = await completeUpload({
      pathname: String(b.pathname || ""),
      intent: String(b.intent || ""),
      clientId: String(b.clientId || ""),
      category: String(b.category || ""),
      name: b.name,
      originalName: b.originalName,
      description: b.description,
      contentId: b.contentId ? String(b.contentId) : null,
      newVersionOf: b.newVersionOf ? String(b.newVersionOf) : null,
      markFinal: b.markFinal === true,
      clientVisible: b.clientVisible !== false,
    });
    return Response.json(out, { status: 201 });
  });
