// Shared (client + server) helpers for the configurable home.

export const MAX_WORK = 4;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

const clamp = (n, lo, hi, fallback) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);

export const clampFocal = (n) => clamp(Number(n), 0, 100, 50);
export const clampZoom = (n) => clamp(Number(n), ZOOM_MIN, ZOOM_MAX, 1);

// Non-destructive crop: the file is never touched. The same style is used by
// the public home and the Studio preview, so what you see there is what ships.
export function focalStyle({ focalX = 50, focalY = 50, zoom = 1 } = {}) {
  const pos = `${clampFocal(focalX)}% ${clampFocal(focalY)}%`;
  return { objectPosition: pos, transformOrigin: pos, transform: `scale(${clampZoom(zoom)})` };
}
