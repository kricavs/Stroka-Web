import { revokeSessions } from "@/lib/studio/server/clients";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const DELETE = (_req, { params }) =>
  studioRoute(async () => Response.json({ revoked: await revokeSessions(params.id) }));
