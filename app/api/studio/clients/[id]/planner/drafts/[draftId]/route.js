import { getPlanningDraft } from "@/lib/studio/server/planner";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const GET = (req, { params }) =>
  studioRoute(async () => Response.json(await getPlanningDraft(params.id, params.draftId), { headers: { "Cache-Control": "no-store" } }));
