// Limits and validation shared by the public form (client) and the API (server).

export const LIMITS = { brand: 80, person: 80, commentMin: 20, commentMax: 600 };

export function validateReference(input) {
  const v = {
    brand: String(input?.brand ?? "").trim().replace(/\s+/g, " "),
    person: String(input?.person ?? "").trim().replace(/\s+/g, " "),
    comment: String(input?.comment ?? "").trim().replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n"),
  };
  const errors = {};
  if (!v.brand) errors.brand = "Ingresá el nombre de la marca.";
  else if (v.brand.length > LIMITS.brand) errors.brand = `Máximo ${LIMITS.brand} caracteres.`;
  if (!v.person) errors.person = "Ingresá el nombre del responsable.";
  else if (v.person.length > LIMITS.person) errors.person = `Máximo ${LIMITS.person} caracteres.`;
  if (v.comment.length < LIMITS.commentMin) errors.comment = `Escribí al menos ${LIMITS.commentMin} caracteres.`;
  else if (v.comment.length > LIMITS.commentMax) errors.comment = `Máximo ${LIMITS.commentMax} caracteres.`;
  return { value: v, errors, ok: Object.keys(errors).length === 0 };
}
