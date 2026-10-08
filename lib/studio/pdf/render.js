import { registerFonts } from "./theme";
import { STUDIO_BRAND } from "../config";
import { computeTotals, forRender } from "../calc";

// Client-side: builds the real PDF (vector text, embedded fonts) as a Blob.
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
  const doc = React.createElement(BudgetDocument, {
    budget: b,
    logoSrc: `${origin}${STUDIO_BRAND.logoPath}`,
  });
  return pdf(doc).toBlob();
}

export function pdfFileName(b) {
  const clean = (s) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${b.number || "Presupuesto"}_${clean(b.clientName) || "cliente"}.pdf`;
}
