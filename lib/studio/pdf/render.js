import { registerFonts } from "./theme";
import { STUDIO_BRAND } from "../config";
import { computeTotals, forRender } from "../calc";

// Client-side: builds the real PDF (vector text, embedded fonts) as a Blob.
// Layout is two-pass: if the normal rhythm spills onto a second page, try the
// compact rhythm and keep it only when the whole document then fits on ONE page.
// Anything that really needs 2+ pages keeps the roomy layout (and is rebalanced).
export async function renderBudgetPdf(budget) {
  budget = forRender(budget);
  const origin = window.location.origin;
  await registerFonts(origin);
  const [{ pdf }, { default: BudgetDocument }, React] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./BudgetDocument"),
    import("react"),
  ]);
  const b = { ...budget, ...computeTotals(budget) };
  const logoSrc = `${origin}${STUDIO_BRAND.logoPath}`;

  async function build({ compact = false, breakBefore = null } = {}) {
    let pages = 0;
    const onPages = (n) => Number.isFinite(n) && (pages = Math.max(pages, n));
    const blob = await pdf(
      React.createElement(BudgetDocument, { budget: b, logoSrc, compact, onPages, breakBefore })
    ).toBlob();
    return { blob, pages };
  }

  const normal = await build();
  if (normal.pages <= 1) return normal.blob;
  const compact = await build({ compact: true });
  if (compact.pages === 1) return compact.blob;
  return rebalance(normal, b, build);
}

// Multi-page documents: if the last page is mostly empty, try moving a whole block
// (a service row, or the payment/conditions block) to the next page, trying the
// smallest moves first and stopping once no page is sparse; otherwise the best
// variant wins. Page count never increases.
const LAST_PAGE_MIN_FILL = 0.6;
const MIN_GAIN = 0.06;
const ACCEPT_FILL = 0.6; // candidates run from the smallest move to the largest

async function rebalance(normal, b, build) {
  const { pageFills } = await import("./measure");
  const base = await pageFills(normal.blob);
  if (base[base.length - 1] >= LAST_PAGE_MIN_FILL) return normal.blob;

  const candidates = [];
  if (b.type === "detailed") {
    const n = b.items.length;
    for (let k = n - 1; k >= Math.max(1, n - 3); k--) candidates.push(`item:${k}`);
  }
  if (b.paymentTerms) candidates.push("pago");
  if (b.conditions) candidates.push("condiciones");

  let best = { blob: normal.blob, score: Math.min(...base) };
  for (const breakBefore of candidates) {
    const res = await build({ breakBefore });
    if (res.pages !== normal.pages) continue;
    const score = Math.min(...(await pageFills(res.blob)));
    if (score > best.score + MIN_GAIN) best = { blob: res.blob, score };
    if (best.score >= ACCEPT_FILL) break; // smallest move that leaves no page sparse
  }
  return best.blob;
}

export function pdfFileName(b) {
  const clean = (s) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${b.number || "Presupuesto"}_${clean(b.clientName) || "cliente"}.pdf`;
}
