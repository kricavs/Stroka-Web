"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import NameField from "./NameField";
import { btnLine, btnSolid, portalApi } from "./portalApi";

export default function TaskComplete({ taskId, hasName }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function complete(e) {
    e?.preventDefault();
    if (!hasName && !asking) return setAsking(true);
    setBusy(true);
    setError("");
    const r = await portalApi(`/api/portal/tasks/${taskId}`, "PATCH", { action: "complete", name: hasName ? undefined : name });
    setBusy(false);
    if (r.ok || r.status === 409) return router.refresh();
    setError(r.data.error || "No se pudo completar.");
  }

  return (
    <form onSubmit={complete} className="mt-4 space-y-3">
      {asking && !hasName && <NameField value={name} onChange={setName} />}
      {error && <p role="alert" className="text-sm text-[#e28a80]">{error}</p>}
      <button type="submit" disabled={busy} className={asking ? btnSolid : btnLine}>{busy ? "Guardando…" : "Marcar como completada"}</button>
    </form>
  );
}
