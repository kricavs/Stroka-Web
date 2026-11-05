import { registerExternalApproval } from "@/lib/studio/server/content";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    return Response.json(await registerExternalApproval(params.id, { approverName: b.approverName, channel: b.channel, note: b.note }));
  });
