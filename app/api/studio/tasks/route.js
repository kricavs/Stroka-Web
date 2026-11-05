import { createTask } from "@/lib/studio/server/tasks";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

export const POST = (req) => studioRoute(async () => Response.json({ id: await createTask(await readJson(req)) }, { status: 201 }));
