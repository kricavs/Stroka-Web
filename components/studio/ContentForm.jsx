"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { api } from "./api";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/shared/content.js";

// initial: { clientId, title, platform, contentType, scheduledLocal, copy, internalNotes,
//            clientNotes, assignee, previewUrl, publishedUrl, status }
export default function ContentForm({ id, initial, clients }) {
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
    const r = editing ? await api(`/api/studio/content/${id}`, "PATCH", f) : await api("/api/studio/content", "POST", f);
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo guardar.");
    if (editing) {
      setSaved(true);
      router.refresh();
    } else router.push(`/studio/contenido/${r.data.id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      {!editing && (
        <Field label="Cliente">
          <Select name="clientId" defaultValue={initial.clientId || ""} required>
            <option value="" disabled>Elegí un cliente…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Título">
        <Input name="title" defaultValue={initial.title} required maxLength={200} autoFocus={!editing} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Plataforma">
          <Select name="platform" defaultValue={initial.platform || "instagram"}>
            {PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select name="contentType" defaultValue={initial.contentType || "post"}>
            {CONTENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Responsable">
          <Input name="assignee" defaultValue={initial.assignee} maxLength={80} />
        </Field>
      </div>
      <Field label="Fecha y hora (Buenos Aires)" hint="Dejá vacío para “sin fecha”.">
        <Input type="datetime-local" name="scheduledLocal" defaultValue={initial.scheduledLocal || ""} className="sm:!w-72" />
      </Field>
      {!editing && (
        <Field label="Estado inicial">
          <Select name="status" defaultValue="idea" className="sm:!w-72">
            <option value="idea">Idea</option>
            <option value="production">En producción</option>
          </Select>
        </Field>
      )}
      <Field label="Copy" hint="Lo ve el cliente cuando el contenido está en revisión o más adelante.">
        <Textarea name="copy" rows={6} defaultValue={initial.copy} maxLength={8000} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Notas internas" hint="Solo Studio.">
          <Textarea name="internalNotes" rows={4} defaultValue={initial.internalNotes} maxLength={4000} />
        </Field>
        <Field label="Notas para el cliente" hint="Visibles en el portal.">
          <Textarea name="clientNotes" rows={4} defaultValue={initial.clientNotes} maxLength={2000} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Link de preview" hint="YouTube no listado, Drive, etc. (https)">
          <Input name="previewUrl" type="url" defaultValue={initial.previewUrl} maxLength={500} />
        </Field>
        <Field label="Link publicado">
          <Input name="publishedUrl" type="url" defaultValue={initial.publishedUrl} maxLength={500} />
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-[#6fbf8e]">Guardado.</p>}
      <Button type="submit" variant="solid" disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear contenido"}</Button>
    </form>
  );
}
