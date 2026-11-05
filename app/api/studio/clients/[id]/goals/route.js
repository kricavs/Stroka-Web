import { setMonthGoal } from "@/lib/studio/server/clients";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const PUT = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    await setMonthGoal(params.id, b.month, b.contracted);
    return Response.json({ ok: true });
  });
