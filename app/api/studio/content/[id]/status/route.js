import { changeStatus } from "@/lib/studio/server/content";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req, { params }) =>
  studioRoute(async () => Response.json(await changeStatus(params.id, (await readJson(req)).status)));
