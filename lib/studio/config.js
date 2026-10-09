// Single source of truth for Stroka's institutional data used in budgets/PDF.
// Values marked PLACEHOLDER are not real yet: replace them here (not in the
// components). Empty strings are simply omitted from the PDF footer.

export const STUDIO_BRAND = {
  name: "Stroka Visual",
  wordmark: "STROKA VISUAL",
  tagline: "Producción audiovisual y contenido para marcas", // texto real de la pieza de referencia
  email: "contacto@strokavisual.com",
  phone: "", // PLACEHOLDER: teléfono real pendiente (ej. "+54 9 381 000 0000")
  instagram: "@stroka.visual",
  website: "strokavisual.com",
  location: "", // PLACEHOLDER: ciudad / país (opcional)
  logoPath: "/logo-stroka.png",
  logoWidth: 823, // real pixel size of the file: keeps the ratio intact
  logoHeight: 232,
};

export const NUMBER_PREFIX = "STK";
export const DEFAULT_VALID_DAYS = 15;

export const CURRENCIES = [
  { code: "ARS", label: "ARS — Peso argentino", symbol: "$" },
  { code: "USD", label: "USD — Dólar estadounidense", symbol: "US$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
];

export const STATUSES = ["BORRADOR", "ENVIADO", "APROBADO", "RECHAZADO"];

export const PROPOSAL_TYPES = [
  { value: "plans", label: "Planes comparativos" },
  { value: "simple", label: "Propuesta simple" },
  { value: "detailed", label: "Propuesta detallada" },
];

export const DEFAULT_PAYMENT_TERMS = "";
export const DEFAULT_CONDITIONS = "";
