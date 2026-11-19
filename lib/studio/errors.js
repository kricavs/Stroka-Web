// Expected failures that routes turn into 4xx responses.
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}
// Optimistic concurrency: the caller edited a stale copy.
export class VersionConflictError extends InputError {
  constructor(expectedVersion, currentVersion) {
    super("El contenido cambió desde que lo leíste. Volvé a leerlo antes de modificarlo.", 409);
    this.name = "VersionConflictError";
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}
export const errorResponse = (err) => {
  if (err instanceof InputError) return Response.json({ error: err.message }, { status: err.status });
  console.error("[studio]", err);
  return Response.json({ error: "Error interno" }, { status: 500 });
};
