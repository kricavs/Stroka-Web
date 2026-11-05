"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { portalApi } from "./portalApi";

// "Cambiar nombre": the declared name for this session (not verified).
export default function ChangeName({ name }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name || "");
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    const r = await portalApi("/api/portal/session", "PUT", { name: value });
    if (!r.ok) return setError(r.data.error || "No se pudo guardar.");
    setOpen(false);
    setError("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-[44px] text-left text-xs font-light text-[#9a9aa3] hover:text-[#f4f4f2] sm:min-h-0">
        {name ? <>Respondiendo como <span className="text-[#f4f4f2]">{name}</span> · Cambiar nombre</> : "Poner mi nombre"}
      </button>
    );
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} className="min-h-[44px] w-48 border border-[#34343c] bg-[#1d1d22] px-3 text-sm sm:min-h-0 sm:py-1.5" aria-label="Tu nombre" autoFocus required />
      <button className="min-h-[44px] px-3 text-xs uppercase tracking-wider2 text-[var(--accent)] sm:min-h-0">Guardar</button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-2 text-xs text-[#9a9aa3] sm:min-h-0">Cancelar</button>
      {error && <span className="text-xs text-[#e28a80]">{error}</span>}
    </form>
  );
}
