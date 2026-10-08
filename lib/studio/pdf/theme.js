// Locked Stroka visual system for budgets. Not editable from the UI.
export const C = {
  ink: "#0a0a0b",
  graphite: "#1c1c1e",
  paper: "#ffffff",
  mist: "#f4f3f0",
  grey: "#8a8a8a",
  text: "#2a2a2c",
  champagne: "#c8b697",
  line: "#d8d5cf",
};

export const F = { display: "StrokaDisplay", body: "StrokaBody" };

// A4 portrait in pt: 595.28 × 841.89
export const PAGE = { margin: 44, top: 64, bottom: 84 };

let registered = false;
export async function registerFonts(origin) {
  if (registered) return;
  const { Font } = await import("@react-pdf/renderer");
  const u = (f) => `${origin}/studio-fonts/${f}-normal.woff`;
  Font.register({
    family: F.display,
    fonts: [
      { src: u("barlow-condensed-latin-300"), fontWeight: 300 },
      { src: u("barlow-condensed-latin-500"), fontWeight: 500 },
      { src: u("barlow-condensed-latin-600"), fontWeight: 600 },
      { src: u("barlow-condensed-latin-700"), fontWeight: 700 },
    ],
  });
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
