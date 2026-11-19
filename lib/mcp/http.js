// HTTP face of the MCP interface: bearer auth → rate limit → stateless Streamable
// HTTP handler. Pure of Next/server-only so it is testable with node --test; the
// route injects the db and the rate limiter.
import { createMcpHandler } from "@modelcontextprotocol/server";
import { McpError } from "./errors.js";
import { createMcpServer } from "./server.js";
import { authenticateMcpToken } from "./tokens-core.js";

export const MCP_RATE_LIMIT = { perMinute: 60, failedPerMinute: 30 };

const NO_STORE = { "Cache-Control": "no-store" };
const STATUS = { AUTH_REQUIRED: 401, TOKEN_REVOKED: 401, RATE_LIMITED: 429 };
const MESSAGE = {
  AUTH_REQUIRED: "Falta un token MCP válido (Authorization: Bearer ...).",
  TOKEN_REVOKED: "Este acceso fue revocado. Generá uno nuevo desde Studio.",
  RATE_LIMITED: "Demasiadas solicitudes. Esperá un momento.",
};

export function errorResponse(code, extraHeaders = {}) {
  return Response.json({ error: new McpError(code, MESSAGE[code]).toJSON() }, {
    status: STATUS[code] || 400,
    headers: { ...NO_STORE, ...(code === "RATE_LIMITED" ? { "Retry-After": "30" } : { "WWW-Authenticate": 'Bearer realm="stroka-studio"' }), ...extraHeaders },
  });
}

// deps: { db, allow(key, limit, windowSeconds) → Promise<boolean>, failKey(req) → string, now?, onError? }
export async function handleMcpRequest(req, deps) {
  const { db, allow, failKey, now, onError = () => {} } = deps;
  try {
    const auth = await authenticateMcpToken(db, req.headers.get("authorization"));
    if (!auth.ok) {
      // Throttle credential guessing per source, never per claimed token.
      if (!(await allow(`mcp-fail:${failKey(req)}`, MCP_RATE_LIMIT.failedPerMinute, 60))) return errorResponse("RATE_LIMITED");
      return errorResponse(auth.code);
    }
    const { scope } = auth;
    if (!(await allow(`mcp:${scope.tokenId}`, MCP_RATE_LIMIT.perMinute, 60))) return errorResponse("RATE_LIMITED");

    const handler = createMcpHandler(
      () => createMcpServer({ db, scope, now, onUnexpected: (e, tool) => onError(e, tool) }),
      { legacy: "stateless", onerror: (e) => onError(e, "transport") }
    );
    const res = await handler.fetch(req);
    const headers = new Headers(res.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(res.body, { status: res.status, headers });
  } catch (err) {
    onError(err, "request");
    return Response.json({ error: { code: "INVALID_INPUT", message: "Error interno." } }, { status: 500, headers: NO_STORE });
  }
}
