import { updateContent } from "@/lib/studio/server/content";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const PATCH = (req, { params }) =>
  studioRoute(async () => Response.json(await updateContent(params.id, await readJson(req))));
