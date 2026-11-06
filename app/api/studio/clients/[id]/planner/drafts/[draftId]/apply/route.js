import { applyPlanningDraft } from "@/lib/studio/server/planner";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Applies the reviewed draft to the calendar in ONE transaction.
export const POST = (req, { params }) => studioRoute(async () => Response.json(await applyPlanningDraft(params.id, params.draftId)));
