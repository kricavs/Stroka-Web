"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { api } from "./api";

export default function ToggleActive({ id, active, compact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (active && !window.confirm("¿Desactivar este cliente? Sus sesiones dejan de funcionar de inmediato; podés reactivarlo cuando quieras.")) return;
    setBusy(true);
    await api(`/api/studio/clients/${id}`, "PATCH", { active: !active });
    setBusy(false);
    router.refresh();
  }
  return (
    <Button variant={active ? "danger" : "line"} onClick={toggle} disabled={busy} className={compact ? "!px-3 !py-1.5" : ""}>
      {active ? "Desactivar" : "Activar"}
    </Button>
  );
}
