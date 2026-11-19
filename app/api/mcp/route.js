import { mcpRoute } from "@/lib/mcp/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remote MCP endpoint (Streamable HTTP, stateless). Auth: Authorization: Bearer
// stk_mcp_… (per-client token, see Studio → Cliente → Acceso). The Studio session
// is never used here. The transport answers GET/DELETE with 405 (no sessions).
export const POST = mcpRoute;
export const GET = mcpRoute;
export const DELETE = mcpRoute;
