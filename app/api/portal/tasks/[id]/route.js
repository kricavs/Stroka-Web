import { completeClientTask } from "@/lib/portal/server/actions";
import { portalRoute, readBody } from "@/lib/portal/server/route";
import { InputError } from "@/lib/studio/errors.js";

export const runtime = "nodejs";

// The client can do exactly one thing to a task: complete it.
export const PATCH = (req, { params }) =>
  portalRoute(async (scope) => {
    const b = await readBody(req);
    if (b.action !== "complete") throw new InputError("Acción no permitida.", 400);
    return Response.json(await completeClientTask(scope, { taskId: params.id, name: b.name }));
  });
