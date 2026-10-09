import { registerFonts } from "./theme";
import { STUDIO_BRAND } from "../config";
import { computeTotals, forRender } from "../calc";

// Client-side: builds the real PDF (vector text, embedded fonts) as a Blob.
// Layout is two-pass: if the normal rhythm spills onto a second page, try the
// compact rhythm and keep it only when the whole document then fits on ONE page.
// Anything that really needs 2+ pages keeps the roomy layout.
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

  async function build(compact) {
    let pages = 0;
    const onPages = (n) => Number.isFinite(n) && (pages = Math.max(pages, n));
    const blob = await pdf(
      React.createElement(BudgetDocument, { budget: b, logoSrc, compact, onPages })
    ).toBlob();
    return { blob, pages };
  }

  const normal = await build(false);
  if (normal.pages <= 1) return normal.blob;
  const compact = await build(true);
  return compact.pages === 1 ? compact.blob : normal.blob;
}

export function pdfFileName(b) {
  const clean = (s) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${b.number || "Presupuesto"}_${clean(b.clientName) || "cliente"}.pdf`;
}
