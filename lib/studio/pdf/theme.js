// Locked Stroka visual system for budgets (black page, white type, champagne
// accent), derived from design-reference/presupuestos. Not editable from the UI.
export const C = {
  ink: "#0b0a09", // page
  panel: "#100f0d", // subtle module fill
  text: "#f1efea",
  grey: "#8f8b84",
  champagne: "#b9a388",
  line: "#34312d", // hairlines
  border: "#55524d", // module borders
  onChampagne: "#14110d",
};

export const F = { display: "StrokaDisplay", body: "StrokaBody" };

// A4 portrait in pt: 595.28 × 841.89
export const PAGE = { margin: 42, top: 72, bottom: 80 };

let registered = false;
export async function registerFonts(origin) {
  if (registered) return;
  const { Font } = await import("@react-pdf/renderer");
  const u = (f) => `${origin}/studio-fonts/${f}-normal.woff`;
  // Anton only ships one (heavy) weight: always use fontWeight 400 with it.
  Font.register({ family: F.display, fonts: [{ src: u("anton-latin-400"), fontWeight: 400 }] });
  Font.register({
    family: F.body,
    fonts: [
      { src: u("inter-latin-300"), fontWeight: 300 },
      { src: u("inter-latin-400"), fontWeight: 400 },
      { src: u("inter-latin-500"), fontWeight: 500 },
      { src: u("inter-latin-600"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

// Big condensed titles: shrink with length so they stay on 1–3 strong lines.
export function titleSize(text = "") {
  const n = text.length;
  if (n <= 12) return 78;
  if (n <= 24) return 66;
  if (n <= 40) return 54;
  return 44;
}
