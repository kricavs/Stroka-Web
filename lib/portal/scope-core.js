// ClientScope — the only way portal code may address a client's data.
//
// A scope is minted ONLY from a verified source:
//   - a valid, unrevoked portal session of an active client   (source "session")
//   - an authenticated Studio admin in "ver como cliente"     (source "admin-preview")
// and carries the client id. Repositories take a scope, never a client id from
// a URL, body or query string. Pure module: no framework imports, so it is
// unit-tested directly.

const BRAND = Symbol.for("stroka.portal.client-scope");

// Minting is restricted by an ESLint rule to the two modules that verify the
// source (lib/portal/server/session.js, lib/studio/server/viewAsClient.js).
export function mintScope({ clientId, source, sessionId = null, displayName = null }) {
  if (typeof clientId !== "string" || !clientId) throw new Error("ClientScope: clientId requerido");
  if (source !== "session" && source !== "admin-preview") throw new Error("ClientScope: origen inválido");
  return Object.freeze({ [BRAND]: true, clientId, source, sessionId, displayName });
}

// JSON from a request can't carry a symbol key, so request data can never
// satisfy this check — only objects built by mintScope can.
export function isScope(value) {
  return Boolean(value && typeof value === "object" && value[BRAND] === true && typeof value.clientId === "string");
}

export function assertScope(value) {
  if (!isScope(value)) throw new Error("Se requiere un ClientScope válido.");
  return value;
}

// Admin "ver como cliente" renders but must never ACT as the client
// (approve, comment, complete tasks…). Call this at the top of every mutation.
export function assertWritable(scope) {
  assertScope(scope);
  if (scope.source !== "session") throw new Error("Modo vista cliente: acción no permitida.");
  return scope;
}

// Convention for portal SQL: $1 is ALWAYS the scope's client id and every
// statement filters on it:  ... WHERE client_id = $1 AND id = $2
// The guard is a tripwire against forgetting the filter, not a proof; review
// and the composite FKs (Fase 1) are the other layers.
const CLIENT_FILTER = /\bclient_id\s*=\s*\$1\b/i;
const SELF_FILTER = /\bFROM\s+clients\b[\s\S]*\bid\s*=\s*\$1\b/i;

export function guardScopedSql(sql, { self = false } = {}) {
  const ok = self ? SELF_FILTER.test(sql) : CLIENT_FILTER.test(sql);
  if (!ok) {
    throw new Error(
      self
        ? "Consulta de portal sin filtro por el cliente (FROM clients … id = $1)."
        : "Consulta de portal sin filtro obligatorio: falta `client_id = $1`."
    );
  }
}

// Wraps a `query(sql, params)` so $1 is injected from the scope.
export function scopedRunner(query, scope) {
  assertScope(scope);
  return (sql, params = [], opts) => {
    guardScopedSql(sql, opts);
    return query(sql, [scope.clientId, ...params]);
  };
}
