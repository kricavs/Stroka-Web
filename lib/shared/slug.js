// Text normalisation for client slugs and the portal "Empresa" login key.

const strip = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// URL-ish identifier: "Laboratorio Millet S.A." → "laboratorio-millet-s-a"
export function slugify(name) {
  return strip(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// What the client types in "Empresa" is compared through this: case, accents,
// spacing and punctuation don't matter ("laboratorio  MILLET" = "Laboratorio Millet").
export function loginKey(name) {
  return strip(name).replace(/[^a-z0-9]+/g, "").slice(0, 80);
}
