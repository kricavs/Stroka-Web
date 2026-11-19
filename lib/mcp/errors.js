// Structured errors of the MCP interface. `code` is part of the public contract.
// Nothing here ever carries SQL, stack traces or secrets.
export const MCP_CODES = [
  "AUTH_REQUIRED", "TOKEN_REVOKED", "READ_ONLY", "NOT_FOUND", "CONFLICT", "INVALID_INPUT", "INVALID_TRANSITION", "RATE_LIMITED",
];
export class McpError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.extra = extra;
  }
  toJSON() {
    return { code: this.code, message: this.message, ...this.extra };
  }
}
