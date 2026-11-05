"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { api } from "./api";

export default function TaskStatusButtons({ id, status, compact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go(to) {
    if (to === "cancelled" && !window.confirm("¿Cancelar esta tarea?")) return;
    setBusy(true);
    await api(`/api/studio/tasks/${id}/status`, "POST", { status: to });
    setBusy(false);
    router.refresh();
  }
  const cls = compact ? "!px-3 !py-1.5" : "";
  const open = status === "pending" || status === "in_progress";
  return (
    <span className="inline-flex flex-wrap gap-2">
      {open && <Button variant="line" className={cls} disabled={busy} onClick={() => go("completed")}>Completar</Button>}
      {status === "pending" && <Button variant="ghost" className={cls} disabled={busy} onClick={() => go("in_progress")}>En curso</Button>}
      {open && <Button variant="danger" className={cls} disabled={busy} onClick={() => go("cancelled")}>Cancelar</Button>}
      {!open && <Button variant="line" className={cls} disabled={busy} onClick={() => go("pending")}>Reabrir</Button>}
    </span>
  );
}
