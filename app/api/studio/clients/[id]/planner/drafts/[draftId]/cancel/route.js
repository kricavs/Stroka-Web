import { cancelPlanningDraft } from "@/lib/studio/server/planner";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req, { params }) => studioRoute(async () => Response.json(await cancelPlanningDraft(params.id, params.draftId)));
