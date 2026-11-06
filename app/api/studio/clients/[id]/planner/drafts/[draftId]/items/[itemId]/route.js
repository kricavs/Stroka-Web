import { updatePlanningDraftItem } from "@/lib/studio/server/planner";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Edit one piece of a draft (or skip it / resolve its conflict). Never touches the calendar.
export const PATCH = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    const patch = {};
    for (const k of ["date", "time", "format", "title", "detail", "pillar", "cta", "platform", "skipped", "resolution"]) if (b[k] !== undefined) patch[k] = b[k];
    return Response.json(await updatePlanningDraftItem(params.id, params.draftId, params.itemId, patch));
  });
