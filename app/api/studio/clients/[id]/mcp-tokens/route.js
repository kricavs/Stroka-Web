import { createMcpToken } from "@/lib/mcp/server/tokens";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Issues a Claude/MCP credential for THIS client. The plaintext token is in this
// response only; only its hash is stored.
export const POST = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    const out = await createMcpToken(params.id, { label: b.label, canWrite: b.canWrite !== false });
    return Response.json({ ...out, url: `${new URL(req.url).origin}/api/mcp` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
