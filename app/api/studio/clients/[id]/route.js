import { setActive, updateClient } from "@/lib/studio/server/clients";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const PATCH = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    if (typeof b.active === "boolean") await setActive(params.id, b.active);
    const { active, ...rest } = b;
    void active;
    if (Object.keys(rest).length) await updateClient(params.id, rest);
    return Response.json({ ok: true });
  });
