"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { api } from "./api";
import { STATUS_LABEL, STUDIO_TRANSITIONS } from "@/lib/shared/content.js";

export default function StatusActions({ id, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  async function go(to) {
    if (to === "cancelled" && !window.confirm("¿Cancelar este contenido? Deja de ser visible para el cliente.")) return;
    setBusy(true);
    setError("");
    const r = await api(`/api/studio/content/${id}/status`, "POST", { status: to });
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo cambiar el estado.");
    router.refresh();
  }
  async function reopen() {
    setBusy(true);
    setError("");
    const r = await api(`/api/studio/content/${id}/reopen`, "POST", {});
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo reabrir el contenido.");
    setConfirming(false);
    router.refresh();
  }
  const next = STUDIO_TRANSITIONS[status] || [];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next.length === 0 && <span className="text-sm text-ash">Estado final.</span>}
        {status === "published" && !confirming && (
          <Button variant="line" disabled={busy} onClick={() => setConfirming(true)}>Reabrir contenido</Button>
        )}
        {next.map((to) => (
          <Button key={to} variant={to === "cancelled" ? "danger" : "line"} disabled={busy} onClick={() => go(to)}>
            → {STATUS_LABEL[to]}
          </Button>
        ))}
      </div>
      {status === "published" && confirming && (
        <div role="alertdialog" className="mt-3 max-w-xl space-y-3 border border-edge bg-panel p-5">
          <p className="text-sm">Este contenido figura como publicado. ¿Querés devolverlo a Producción?</p>
          <div className="flex gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button variant="solid" disabled={busy} onClick={reopen}>{busy ? "Reabriendo…" : "Reabrir contenido"}</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
