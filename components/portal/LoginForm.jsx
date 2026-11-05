"use client";

import { useState } from "react";

const input =
  "w-full border border-[#34343c] bg-[#1d1d22] px-4 py-3.5 text-base font-light text-[#f4f4f2] placeholder:text-[#6f6f78] focus:border-[#b9a388] focus:outline-none";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: f.get("company"), code: f.get("code") }),
      });
      if (res.ok) {
        window.location.href = "/portal/resumen";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Empresa o código incorrectos.");
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <label className="block">
        <span className="mb-2 block text-[0.62rem] font-medium uppercase tracking-wider2 text-[#9a9aa3]">Empresa</span>
        <input name="company" className={input} autoComplete="organization" autoCapitalize="words" required autoFocus />
      </label>
      <label className="block">
        <span className="mb-2 block text-[0.62rem] font-medium uppercase tracking-wider2 text-[#9a9aa3]">Código de acceso</span>
        <input name="code" className={`${input} font-mono tracking-widest`} autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder="STK-XXXXX-XXXXX" required />
      </label>
      {error && <p role="alert" className="text-sm text-[#e28a80]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-[#b9a388] px-6 py-4 text-[0.72rem] font-semibold uppercase tracking-wider2 text-[#0a0a0b] transition-colors hover:bg-[#f4f4f2] disabled:opacity-50"
      >
        {busy ? "Verificando…" : "Ingresar →"}
      </button>
    </form>
  );
}
