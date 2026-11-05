import { generateAccess } from "@/lib/studio/server/clients";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Generates or regenerates the access code. The plaintext is in THIS response
// only; it is never stored and can't be shown again.
export const POST = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    const out = await generateAccess(params.id, {
      revokeSessions: b.revokeSessions !== false,
      origin: new URL(req.url).origin,
    });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  });
