"use client";

import { useEffect, useRef, useState } from "react";
import { renderBudgetPdf } from "@/lib/studio/pdf/render";

// Rasterises the *actual* PDF (same template as the export) page by page with
// pdf.js, so the preview works in every browser (no embedded PDF viewer needed).
async function pdfToImages(blob, cssWidth) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.js",
    import.meta.url
  ).toString();
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const images = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (cssWidth * dpr) / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    images.push(canvas.toDataURL("image/png"));
  }
  await doc.destroy();
  return images;
}

export default function PdfPreview({ budget }) {
  const box = useRef(null);
  const [pages, setPages] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const lastUrl = useRef(null);

  useEffect(() => {
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const blob = await renderBudgetPdf(budget);
        const width = Math.max(300, (box.current?.clientWidth || 600) - 24);
        const images = await pdfToImages(blob, width);
        if (id !== seq.current) return;
        const url = URL.createObjectURL(blob);
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setPdfUrl(url);
        setPages(images);
        setError("");
      } catch (e) {
        console.error(e);
        if (id === seq.current) setError("No se pudo generar la vista previa.");
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [budget]);

  useEffect(() => () => lastUrl.current && URL.revokeObjectURL(lastUrl.current), []);

  return (
    <div ref={box} className="relative h-full min-h-[70vh] overflow-y-auto bg-graphite p-3">
      <div className="mx-auto space-y-3">
        {pages.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`Página ${i + 1} del presupuesto`} className="block w-full shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
        ))}
      </div>
      {(busy || error) && (
        <div className="sticky bottom-0 mt-3 inline-block bg-ink/90 px-3 py-1.5 text-[0.6rem] uppercase tracking-wider2 text-champagne">
          {error || "Actualizando vista previa…"}
        </div>
      )}
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="sticky bottom-0 float-right bg-ink/90 px-3 py-1.5 text-[0.6rem] uppercase tracking-wider2 text-ash hover:text-bone">
          Abrir PDF
        </a>
      )}
    </div>
  );
}
