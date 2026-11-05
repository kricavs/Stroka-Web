import { addClientComment } from "@/lib/portal/server/actions";
import { listComments } from "@/lib/portal/server/content";
import { portalRoute, readBody } from "@/lib/portal/server/route";

export const runtime = "nodejs";

export const GET = (_req, { params }) =>
  portalRoute(async (scope) => Response.json({ comments: await listComments(scope, params.id) }));

export const POST = (req, { params }) =>
  portalRoute(async (scope) => {
    const b = await readBody(req);
    return Response.json(await addClientComment(scope, { contentId: params.id, body: b.body, name: b.name }), { status: 201 });
  });
