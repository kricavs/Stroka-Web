import { setSessionName } from "@/lib/portal/server/actions";
import { portalRoute, readBody } from "@/lib/portal/server/route";

export const runtime = "nodejs";

// Declared (not verified) name of whoever is using this session.
export const PUT = (req) =>
  portalRoute(async (scope) => Response.json(await setSessionName(scope, (await readBody(req)).name)));
