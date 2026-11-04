import { createContent } from "@/lib/studio/server/content";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req) =>
  studioRoute(async () => {
    const b = await readJson(req);
    return Response.json({ id: await createContent(String(b.clientId || ""), b) }, { status: 201 });
  });
