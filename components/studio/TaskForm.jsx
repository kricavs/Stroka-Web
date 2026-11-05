"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { api } from "./api";
import { TASK_PRIORITIES, TASK_VISIBILITIES } from "@/lib/shared/content.js";

// initial: { clientId, contentId, contentTitle, title, description, assignee, dueDate, priority, visibility }
export default function TaskForm({ id, initial, clients }) {
  const router = useRouter();
  const editing = Boolean(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (initial.contentId) f.contentId = initial.contentId;
    const r = editing ? await api(`/api/studio/tasks/${id}`, "PATCH", f) : await api("/api/studio/tasks", "POST", f);
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo guardar.");
    if (editing) {
      setSaved(true);
      router.refresh();
    } else router.push("/studio/tareas");
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <Field label="Título"><Input name="title" defaultValue={initial.title} required maxLength={200} autoFocus={!editing} /></Field>
      <Field label="Descripción"><Textarea name="description" rows={4} defaultValue={initial.description} maxLength={4000} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cliente (opcional)">
          <Select name="clientId" defaultValue={initial.clientId || ""} disabled={Boolean(initial.contentId)}>
            <option value="">Sin cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Contenido">
          <Input value={initial.contentTitle || "—"} readOnly disabled />
        </Field>
        <Field label="Responsable"><Input name="assignee" defaultValue={initial.assignee} maxLength={80} /></Field>
        <Field label="Fecha límite"><Input type="date" name="dueDate" defaultValue={initial.dueDate || ""} /></Field>
        <Field label="Prioridad">
          <Select name="priority" defaultValue={initial.priority || "normal"}>{TASK_PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label="Visibilidad" hint="“Visible para el cliente” exige elegir un cliente y aparece en sus Pendientes.">
          <Select name="visibility" defaultValue={initial.visibility || "internal"}>{TASK_VISIBILITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-[#6fbf8e]">Guardado.</p>}
      <Button type="submit" variant="solid" disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear tarea"}</Button>
    </form>
  );
}
