import { unlockAccess } from "@/lib/studio/server/clients";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (_req, { params }) =>
  studioRoute(async () => {
    await unlockAccess(params.id);
    return Response.json({ ok: true });
  });
