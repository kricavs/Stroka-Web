// Tiny fetch wrapper for portal client components → { ok, status, data }.
export async function portalApi(url, method, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: "Sin conexión. Probá de nuevo." } };
  }
}

export const inputCls =
  "w-full border border-[#34343c] bg-[#1d1d22] px-4 py-3 text-base font-light text-[#f4f4f2] placeholder:text-[#6f6f78] focus:border-[var(--accent)] focus:outline-none";
export const btnSolid =
  "min-h-[44px] bg-[var(--accent)] px-6 text-[0.72rem] font-semibold uppercase tracking-wider2 text-[#0a0a0b] transition-colors hover:bg-[#f4f4f2] disabled:opacity-50";
export const btnLine =
  "min-h-[44px] border border-[#55524d] px-6 text-[0.72rem] uppercase tracking-wider2 text-[#f4f4f2] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50";
