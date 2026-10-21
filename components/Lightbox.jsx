"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// Accessible lightbox built on the native <dialog>: modal semantics, focus
// trap, ESC to close and focus restoration come from the browser.
// Props: photos [{ src, width, height, alt }], index (-1 = closed),
// onIndex(next), onClose().
export default function Lightbox({ photos, index, onIndex, onClose, label = "Galería de fotografías" }) {
  const dialog = useRef(null);
  const touchX = useRef(null);
  const open = index >= 0;
  const count = photos.length;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (step) => onIndex((index + step + count) % count);

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  };

  const onTouchStart = (e) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const photo = open ? photos[index] : null;
  const btn = "absolute z-10 p-3 text-ash transition-colors hover:text-bone focus-visible:text-bone focus-visible:outline focus-visible:outline-1 focus-visible:outline-bone";

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      // Click on the backdrop area (the dialog itself) closes it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 h-full max-h-none w-full max-w-none bg-ink/95 p-0 text-bone backdrop:bg-transparent"
    >
      {photo ? (
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <button type="button" onClick={onClose} aria-label="Cerrar" className={`${btn} right-3 top-3 md:right-6 md:top-6`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {count > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Fotografía anterior" className={`${btn} left-1 md:left-6`}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Fotografía siguiente" className={`${btn} right-1 md:right-6`}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : null}

          <Image
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            sizes="92vw"
            quality={85}
            className="h-auto max-h-[86vh] w-auto max-w-[92vw] object-contain"
          />

          <p aria-live="polite" className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[0.7rem] uppercase tracking-wider2 text-ash">
            {index + 1} / {count}
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
