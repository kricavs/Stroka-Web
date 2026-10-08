// Pure calculation + normalisation helpers. Shared by client (live preview)
// and server (the server always recomputes before saving).

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function lineTotal(item) {
  return round2(toNumber(item.quantity) * toNumber(item.unitPrice));
}

export function computeTotals(b) {
  let subtotal = 0;
  if (b.type === "detailed") {
    subtotal = round2((b.items || []).reduce((s, i) => s + lineTotal(i), 0));
  } else if (b.type === "simple") {
    subtotal = round2(toNumber(b.simple?.price));
  } else {
    return { subtotal: 0, discountAmount: 0, total: 0 };
  }
  const d = b.discount || { kind: "none", value: 0 };
  let discountAmount = 0;
  if (d.kind === "percent") discountAmount = round2((subtotal * toNumber(d.value)) / 100);
  else if (d.kind === "amount") discountAmount = round2(toNumber(d.value));
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
  return { subtotal, discountAmount, total: round2(subtotal - discountAmount) };
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatMoney(amount, currency = "ARS") {
  const n = toNumber(amount);
  const symbol = { ARS: "$", USD: "US$", EUR: "€" }[currency] || currency;
  const hasDecimals = Math.round(n * 100) % 100 !== 0;
  const s = n.toLocaleString("es-AR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${s}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d} de ${months[m - 1]} de ${y}`;
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).slice(0, 12);

export function emptyBudget(type = "detailed") {
  return {
    number: "",
    date: todayISO(),
    validDays: 15,
    clientName: "",
    projectName: "",
    type,
    currency: "ARS",
    items: [{ id: uid(), description: "", detail: "", quantity: 1, unitPrice: 0 }],
    plans: [
      { id: uid(), name: "Plan Inicial", price: 0, unit: "ARS / mes", description: "", features: [""] },
      { id: uid(), name: "Plan Crecimiento", price: 0, unit: "ARS / mes", description: "", features: [""] },
    ],
    simple: { title: "", description: "", deliverables: [""], scope: "", price: 0 },
    discount: { kind: "none", value: 0 },
    paymentTerms: "",
    conditions: "",
    clientNote: "",
    internalNote: "",
    status: "BORRADOR",
  };
}

// Drops blank list rows so previews/exports never show empty bullets.
export function forRender(b) {
  const keep = (a) => (a || []).filter((x) => String(x || "").trim());
  return {
    ...b,
    plans: (b.plans || []).map((p) => ({ ...p, features: keep(p.features) })),
    simple: { ...b.simple, deliverables: keep(b.simple?.deliverables) },
  };
}

// Fills gaps when loading a saved budget into the editor.
export function hydrate(saved) {
  const base = emptyBudget(saved.type);
  const out = { ...base, ...saved };
  if (!saved.items?.length) out.items = base.items;
  if (!saved.plans?.length) out.plans = base.plans;
  out.plans = out.plans.map((p) => ({ ...p, features: p.features?.length ? p.features : [""] }));
  out.simple = { ...base.simple, ...saved.simple };
  if (!out.simple.deliverables?.length) out.simple.deliverables = [""];
  return out;
}
