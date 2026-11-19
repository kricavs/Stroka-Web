// McpScope — the MCP twin of ClientScope. The client id comes ONLY from an
// authenticated, unrevoked token (authenticateMcpToken). Tool input is never a
// source of it: a scope can't be forged from JSON because the brand is a Symbol.
const BRAND = Symbol.for("stroka.mcp.scope");

export function mintMcpScope({ clientId, tokenId, label, canWrite }) {
  if (typeof clientId !== "string" || !clientId) throw new Error("McpScope: clientId requerido");
  return Object.freeze({ [BRAND]: true, clientId, tokenId, label: String(label ?? ""), canWrite: canWrite === true });
}
export const isMcpScope = (v) => Boolean(v && typeof v === "object" && v[BRAND] === true && typeof v.clientId === "string");
export function assertMcpScope(v) {
  if (!isMcpScope(v)) throw new Error("Se requiere un McpScope válido.");
  return v;
}
