import { updateTask } from "@/lib/studio/server/tasks";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const PATCH = (req, { params }) =>
  studioRoute(async () => {
    await updateTask(params.id, await readJson(req));
    return Response.json({ ok: true });
  });
