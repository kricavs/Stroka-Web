import { approveContent } from "@/lib/portal/server/actions";
import { portalRoute, readBody } from "@/lib/portal/server/route";

export const runtime = "nodejs";

export const POST = (req, { params }) =>
  portalRoute(async (scope) => {
    const b = await readBody(req);
    return Response.json(await approveContent(scope, { contentId: params.id, version: b.version, name: b.name }));
  });
