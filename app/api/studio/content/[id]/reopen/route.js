import { reopenContent } from "@/lib/studio/server/content";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// published → production, Studio session only (studioRoute enforces it).
export const POST = (req, { params }) => studioRoute(async () => Response.json(await reopenContent(params.id)));
