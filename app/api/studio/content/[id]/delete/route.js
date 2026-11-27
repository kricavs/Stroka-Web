import { deleteContent } from "@/lib/studio/server/content";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Soft delete of a cancelled content item, Studio session only (studioRoute enforces it).
export const POST = (req, { params }) => studioRoute(async () => Response.json(await deleteContent(params.id)));
