"use client";

import { useRef } from "react";
import { ZOOM_MAX, ZOOM_MIN, clampFocal, focalStyle } from "@/lib/home-shared";

// Visual crop editor. Left: the whole image with a draggable focal point.
// Right: the exact crop the home will show (same CSS as the public site).
// Non-destructive: only focalX / focalY / zoom are stored.
export default function FocalEditor({ url, value, onChange, aspect = "16 / 9", label }) {
  const box = useRef(null);
  const { focalX, focalY, zoom } = value;

  function move(e) {
    const r = box.current.getBoundingClientRect();
    onChange({
      ...value,
      focalX: Math.round(clampFocal(((e.clientX - r.left) / r.width) * 100)),
      focalY: Math.round(clampFocal(((e.clientY - r.top) / r.height) * 100)),
    });
  }

  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-1.5 text-[0.6rem] uppercase tracking-wider2 text-ash">Punto focal — tocá o arrastrá</p>
        <div
          ref={box}
          className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
          onPointerDown={(e) => {
            move(e);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => e.buttons && move(e)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} className="block max-h-72 w-auto max-w-full" />
          <span
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
            style={{ left: `${focalX}%`, top: `${focalY}%` }}
          >
            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone" />
          </span>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 flex justify-between text-[0.6rem] uppercase tracking-wider2 text-ash">
            <span>Zoom</span>
            <span>{zoom.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            value={zoom}
            onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })}
            className="w-full accent-[#b9a388]"
          />
        </label>
        <button
          type="button"
          className="mt-2 text-[0.6rem] uppercase tracking-wider2 text-ash hover:text-bone"
          onClick={() => onChange({ ...value, focalX: 50, focalY: 50, zoom: 1 })}
        >
          Restablecer
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-[0.6rem] uppercase tracking-wider2 text-ash">
          Vista previa{label ? ` — ${label}` : ""}
        </p>
        <div className="relative w-full overflow-hidden bg-graphite" style={{ aspectRatio: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" style={focalStyle(value)} />
        </div>
      </div>
    </div>
  );
}
