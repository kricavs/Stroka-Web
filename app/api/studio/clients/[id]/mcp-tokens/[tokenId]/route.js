import { regenerateMcpToken, revokeMcpToken } from "@/lib/mcp/server/tokens";
import { studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// DELETE = revoke. POST = regenerate (revokes this one and returns a new plaintext once).
export const DELETE = (_req, { params }) =>
  studioRoute(async () => Response.json(await revokeMcpToken(params.id, params.tokenId), { headers: { "Cache-Control": "no-store" } }));

export const POST = (req, { params }) =>
  studioRoute(async () => {
    const out = await regenerateMcpToken(params.id, params.tokenId);
    return Response.json({ ...out, url: `${new URL(req.url).origin}/api/mcp` }, { headers: { "Cache-Control": "no-store" } });
  });
