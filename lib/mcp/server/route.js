import "server-only";
import { getDb } from "@/lib/studio/server/db";
import { allow, clientIpHash } from "@/lib/studio/server/rateLimit";
import { handleMcpRequest } from "../http.js";

export async function mcpRoute(req) {
  return handleMcpRequest(req, {
    db: await getDb(),
    allow,
    failKey: clientIpHash,
    // Log the error object only: never headers, bodies or tokens.
    onError: (err, where) => console.error("[mcp]", where, err?.name, err?.message),
  });
}
