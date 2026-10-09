// Measures how full each page of a generated PDF is (text extent, via pdf.js).
// Used to rebalance multi-page budgets; geometry mirrors theme.js PAGE values.
const TOP = 842 - 72; // where body content starts on every page
const FOOT = 92; // body content never goes below this (footer band)
const HEAD = 800; // running header lives above this

export async function pageFills(blob) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.js",
    import.meta.url
  ).toString();
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  const fills = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const ys = items
      .filter((i) => i.str.trim() && Math.abs(i.transform[0]) > 0.01) // skip rotated side text
      .map((i) => i.transform[5])
      .filter((y) => y > FOOT && y < HEAD);
    fills.push(ys.length ? Math.min(1, Math.max(0, (TOP - Math.min(...ys)) / (TOP - FOOT))) : 0);
  }
  await doc.destroy();
  return fills;
}
