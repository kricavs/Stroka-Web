import "server-only";
import { getDb } from "@/lib/studio/server/db";
import { allow, clientIpHash } from "@/lib/studio/server/rateLimit";
import { handleMcpRequest, isValidMcpAlias } from "../http.js";

export async function mcpRoute(req) {
  return handleMcpRequest(req, {
    db: await getDb(),
    allow,
    failKey: clientIpHash,
    // Log the error object only: never headers, bodies or tokens.
    onError: (err, where) => console.error("[mcp]", where, err?.name, err?.message),
  });
}

// /api/mcp/[alias]: same server, same auth. The alias is only checked for shape and
// never passed on, so it cannot influence the client or the scope.
export async function mcpAliasRoute(req, ctx) {
  if (!isValidMcpAlias(ctx?.params?.alias)) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Endpoint inexistente." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return mcpRoute(req);
}
