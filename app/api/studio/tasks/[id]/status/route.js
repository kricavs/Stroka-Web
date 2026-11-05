import { setTaskStatus } from "@/lib/studio/server/tasks";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req, { params }) =>
  studioRoute(async () => Response.json(await setTaskStatus(params.id, (await readJson(req)).status)));
