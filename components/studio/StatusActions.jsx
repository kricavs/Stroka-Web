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
  async function go(to) {
    if (to === "cancelled" && !window.confirm("¿Cancelar este contenido? Deja de ser visible para el cliente.")) return;
    setBusy(true);
    setError("");
    const r = await api(`/api/studio/content/${id}/status`, "POST", { status: to });
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo cambiar el estado.");
    router.refresh();
  }
  const next = STUDIO_TRANSITIONS[status] || [];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next.length === 0 && <span className="text-sm text-ash">Estado final.</span>}
        {next.map((to) => (
          <Button key={to} variant={to === "cancelled" ? "danger" : "line"} disabled={busy} onClick={() => go(to)}>
            → {STATUS_LABEL[to]}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
