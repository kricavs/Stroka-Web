import { mcpAliasRoute } from "@/lib/mcp/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same MCP server as /api/mcp under a distinct URL (e.g. /api/mcp/pistachia), because
// Claude does not allow two connectors with the same URL. The alias grants nothing:
// the client always comes from the Bearer token.
export const POST = mcpAliasRoute;
export const GET = mcpAliasRoute;
export const DELETE = mcpAliasRoute;
