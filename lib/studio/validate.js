import { CURRENCIES, STATUSES } from "./config";
import { computeTotals, round2, toNumber, uid } from "./calc";

const TYPES = ["plans", "simple", "detailed"];
const str = (v, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lines = (v) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, 40) : []);

// Strict numeric parse: "abc", "" or null are errors, not silent zeros.
const isNumeric = (v) =>
  typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(v);

function money(v, field, errors) {
  const n = toNumber(v);
  if (!isNumeric(v) || n < 0 || n > 1e12) errors.push(`${field}: importe inválido`);
  return round2(n);
}

// Validates + normalises an incoming budget. Returns { errors, data }.
// Totals are always recomputed here; client-sent totals are ignored.
export function validateBudget(input) {
  const errors = [];
  const b = input || {};
  const type = TYPES.includes(b.type) ? b.type : null;
  if (!type) errors.push("Tipo de propuesta inválido");
  const currency = CURRENCIES.some((c) => c.code === b.currency) ? b.currency : null;
  if (!currency) errors.push("Moneda inválida");
  const status = STATUSES.includes(b.status) ? b.status : "BORRADOR";

  const data = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : null,
    validDays: Math.round(toNumber(b.validDays)),
    clientName: str(b.clientName, 200),
    projectName: str(b.projectName, 200),
    intro: str(b.intro, 400), // optional short text under title/client
    type,
    currency,
    status,
    items: [],
    plans: [],
    simple: { title: "", description: "", deliverables: [], scope: "", price: 0 },
    discount: { kind: "none", value: 0 },
    paymentTerms: str(b.paymentTerms),
    conditions: str(b.conditions),
    clientNote: str(b.clientNote),
    internalNote: str(b.internalNote),
  };
  if (!data.date) errors.push("Fecha inválida");
  if (!(data.validDays >= 1 && data.validDays <= 730)) errors.push("Validez: entre 1 y 730 días");
  if (!data.clientName) errors.push("El cliente es obligatorio");
  if (!data.projectName) errors.push("El nombre del proyecto es obligatorio");

  if (type === "detailed") {
    const items = Array.isArray(b.items) ? b.items.slice(0, 100) : [];
    if (!items.length) errors.push("Agregá al menos un ítem");
    items.forEach((it, i) => {
      const n = i + 1;
      const description = str(it.description, 300);
      if (!description) errors.push(`Ítem ${n}: falta la descripción`);
      const quantity = toNumber(it.quantity);
      if (!isNumeric(it.quantity) || !(quantity > 0) || quantity > 1e6) errors.push(`Ítem ${n}: la cantidad debe ser mayor a 0`);
      data.items.push({
        id: str(it.id, 40) || uid(),
        description,
        detail: str(it.detail, 1000),
        quantity: round2(quantity),
        unitPrice: money(it.unitPrice, `Ítem ${n}: precio unitario`, errors),
      });
    });
  } else if (type === "plans") {
    const plans = Array.isArray(b.plans) ? b.plans.slice(0, 3) : [];
    if (plans.length < 2) errors.push("Los planes comparativos requieren 2 o 3 planes");
    plans.forEach((p, i) => {
      const n = i + 1;
      const name = str(p.name, 100);
      if (!name) errors.push(`Plan ${n}: falta el nombre`);
      data.plans.push({
        id: str(p.id, 40) || uid(),
        name,
        price: money(p.price, `Plan ${n}: precio`, errors),
        unit: str(p.unit, 60),
        description: str(p.description, 600),
        features: lines(p.features),
      });
    });
  } else if (type === "simple") {
    const s = b.simple || {};
    data.simple = {
      title: str(s.title, 200),
      description: str(s.description),
      deliverables: lines(s.deliverables),
      scope: str(s.scope),
      price: money(s.price, "Precio", errors),
    };
    if (!data.simple.title) errors.push("El título del servicio es obligatorio");
  }

  const d = b.discount || {};
  const kind = ["none", "percent", "amount"].includes(d.kind) ? d.kind : "none";
  const value = kind === "none" ? 0 : round2(toNumber(d.value));
  if (kind !== "none" && (!isNumeric(d.value) || value < 0)) errors.push("Descuento inválido");
  if (kind === "percent" && value > 100) errors.push("El descuento no puede superar 100%");
  data.discount = { kind, value };

  const totals = computeTotals(data);
  if (kind === "amount" && value > totals.subtotal) errors.push("El descuento supera el subtotal");
  return { errors, data: { ...data, ...totals } };
}
