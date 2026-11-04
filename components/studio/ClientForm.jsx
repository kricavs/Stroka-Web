"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Textarea } from "./ui";
import { api } from "./api";
import { slugify } from "@/lib/shared/slug.js";

export default function ClientForm({ initial }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get("name"),
      displayName: f.get("displayName"),
      monthly: f.get("monthly"),
      accent: f.get("accent"),
      notes: f.get("notes"),
    };
    const r = editing ? await api(`/api/studio/clients/${initial.id}`, "PATCH", body) : await api("/api/studio/clients", "POST", body);
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo guardar.");
    if (editing) {
      setSaved(true);
      router.refresh();
    } else router.push(`/studio/clientes/${r.data.id}?tab=acceso&nuevo=1`);
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <Field label="Nombre de empresa" hint={editing ? "Es lo que el cliente escribe en “Empresa” al ingresar. Si lo cambiás, avisale." : "Es lo que el cliente escribe en “Empresa” al ingresar."}>
        <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus={!editing} />
      </Field>
      <Field label="Nombre visible" hint="Cómo lo saludamos en el portal. Si queda vacío, se usa el nombre de empresa.">
        <Input name="displayName" defaultValue={initial?.display_name !== initial?.name ? initial?.display_name : ""} maxLength={120} />
      </Field>
      {!editing && (
        <p className="text-xs text-ash/70">Identificador interno: <span className="font-mono">{slugify(name) || "—"}</span></p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Contenidos contratados por mes" hint="Valor por defecto; después podés ajustarlo mes a mes.">
          <Input name="monthly" type="number" min="0" max="500" defaultValue={initial?.settings?.defaultMonthly ?? 0} />
        </Field>
        <Field label="Color de acento (opcional)" hint="#RRGGBB">
          <Input name="accent" defaultValue={initial?.accent || ""} placeholder="#b9a388" pattern="#[0-9a-fA-F]{6}" />
        </Field>
      </div>
      <Field label="Notas internas" hint="Solo las ve Studio. Nunca aparecen en el portal.">
        <Textarea name="notes" rows={4} defaultValue={initial?.notes || ""} maxLength={4000} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-[#6fbf8e]">Guardado.</p>}
      <Button type="submit" variant="solid" disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar" : "Crear cliente"}</Button>
    </form>
  );
}
