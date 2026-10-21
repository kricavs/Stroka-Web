"use client";

import Image from "next/image";
import { useState } from "react";
import Lightbox from "@/components/Lightbox";

// Editorial sequence of project photos. Landscape / square frames take the
// full width; consecutive portraits are paired side by side; a lone portrait
// is centered. Every frame keeps its real aspect ratio (no layout shift).
function buildRows(photos) {
  const isPortrait = (p) => p.height > p.width * 1.05;
  const rows = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (isPortrait(p) && photos[i + 1] && isPortrait(photos[i + 1])) {
      rows.push({ kind: "pair", items: [i, i + 1] });
      i++;
    } else {
      rows.push({ kind: isPortrait(p) ? "portrait" : "wide", items: [i] });
    }
  }
  return rows;
}

const SIZES = {
  wide: "(max-width: 1280px) 100vw, 1280px",
  portrait: "(max-width: 768px) 100vw, 640px",
  pair: "(max-width: 1280px) 50vw, 640px",
};

export default function PhotoSequence({ photos, label }) {
  const [index, setIndex] = useState(-1);
  if (!photos.length) return null;

  const frame = (i, kind) => {
    const p = photos[i];
    return (
      <button
        key={p.src}
        type="button"
        onClick={() => setIndex(i)}
        aria-haspopup="dialog"
        className="group block w-full overflow-hidden bg-neutral-900 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-bone"
      >
        <Image
          src={p.src}
          alt={p.alt}
          width={p.width}
          height={p.height}
          sizes={SIZES[kind]}
          className="h-auto w-full transition duration-700 ease-cine group-hover:scale-[1.015]"
        />
        <span className="sr-only"> (ampliar)</span>
      </button>
    );
  };

  return (
    <>
      <div className="space-y-3 sm:space-y-6">
        {buildRows(photos).map((row) => {
          const i = row.items[0];
          if (row.kind === "pair") {
            return (
              <div key={i} className="grid grid-cols-2 gap-3 sm:gap-6">
                {row.items.map((n) => frame(n, "pair"))}
              </div>
            );
          }
          if (row.kind === "portrait") {
            return (
              <div key={i} className="mx-auto w-full max-w-xl md:max-w-2xl">
                {frame(i, "portrait")}
              </div>
            );
          }
          return <div key={i}>{frame(i, "wide")}</div>;
        })}
      </div>
      <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(-1)} label={label} />
    </>
  );
}
