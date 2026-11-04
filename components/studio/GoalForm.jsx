"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "./ui";
import { api } from "./api";

export default function GoalForm({ clientId, month, contracted }) {
  const router = useRouter();
  const [value, setValue] = useState(String(contracted));
  const [state, setState] = useState("");
  async function save(e) {
    e.preventDefault();
    setState("…");
    const r = await api(`/api/studio/clients/${clientId}/goals`, "PUT", { month, contracted: value });
    setState(r.ok ? "Guardado" : r.data.error || "Error");
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-3">
      <Input type="number" min="0" max="500" value={value} onChange={(e) => setValue(e.target.value)} className="!w-24" aria-label="Contenidos contratados este mes" />
      <Button type="submit" variant="line">Guardar</Button>
      {state && <span className="text-xs text-ash">{state}</span>}
    </form>
  );
}
