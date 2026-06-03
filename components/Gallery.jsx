"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Editorial masonry gallery with optional category filters and a built-in
// lightbox (arrows, ESC / X, prev-next, swipe on mobile).
// Props:
//   categories: [{ slug, title, items: [{ id, src, full, width, height, category, alt, optimized }] }]
//   showFilters: boolean
export default function Gallery({ categories = [], showFilters = true }) {
  const [active, setActive] = useState("all");
  const [index, setIndex] = useState(-1);

  const all = categories.flatMap((c) => c.items || []);
  const items = active === "all" ? all : all.filter((it) => it.category === active);

  const close = useCallback(() => setIndex(-1), []);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length]
  );

  // Reset lightbox when the filter changes.
  useEffect(() => setIndex(-1), [active]);

  // Keyboard + scroll lock while the lightbox is open.
  useEffect(() => {
    if (index < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, close, prev, next]);

  // Touch swipe.
  const touchX = useRef(null);
  const onTouchStart = (e) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  const current = index >= 0 ? items[index] : null;
  const filters = [{ slug: "all", title: "Todos" }, ...categories];

  return (
    <div>
      {showFilters && categories.length > 1 ? (
        <div className="mb-10 flex flex-wrap gap-x-7 gap-y-3 border-y hairline py-5">
          {filters.map((f) => {
            const on = active === f.slug;
            return (
              <button
                key={f.slug}
                onClick={() => setActive(f.slug)}
                className={`relative pb-1 text-[0.72rem] uppercase tracking-wider2 transition-colors ${
                  on ? "text-bone" : "text-ash hover:text-bone"
                }`}
              >
                {f.title}
                {on ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-electric" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Masonry via CSS columns */}
      <div className="columns-1 gap-4 sm:columns-2 sm:gap-5 lg:columns-3 lg:gap-6">
        {items.map((it, i) => (
          <button
            key={`${it.id}-${i}`}
            onClick={() => setIndex(i)}
            className="group mb-4 block w-full break-inside-avoid overflow-hidden bg-neutral-900 sm:mb-5 lg:mb-6"
            aria-label="Ampliar imagen"
          >
            <Image
              src={it.src}
              alt={it.alt || ""}
              width={it.width}
              height={it.height}
              unoptimized={!it.optimized}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="h-auto w-full object-cover grayscale transition duration-700 ease-cine group-hover:scale-[1.02] group-hover:grayscale-0"
            />
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm uppercase tracking-wider2 text-ash">
          Sin imágenes en esta categoría
        </p>
      ) : null}

      {/* Lightbox */}
      {current ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 backdrop-blur-sm"
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-5 top-5 z-10 text-ash transition-colors hover:text-bone"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {items.length > 1 ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Anterior"
                className="absolute left-3 z-10 p-3 text-ash transition-colors hover:text-bone md:left-6"
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Siguiente"
                className="absolute right-3 z-10 p-3 text-ash transition-colors hover:text-bone md:right-6"
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.full}
            alt={current.alt || ""}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] object-contain shadow-2xl"
          />

          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[0.7rem] uppercase tracking-wider2 text-ash">
            {index + 1} / {items.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
