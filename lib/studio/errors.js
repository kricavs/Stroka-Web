// Expected failures that routes turn into 4xx responses.
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}
export const errorResponse = (err) => {
  if (err instanceof InputError) return Response.json({ error: err.message }, { status: err.status });
  console.error("[studio]", err);
  return Response.json({ error: "Error interno" }, { status: 500 });
};
