import { createClient } from "@/lib/studio/server/clients";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req) =>
  studioRoute(async () => Response.json({ id: await createClient(await readJson(req)) }, { status: 201 }));
