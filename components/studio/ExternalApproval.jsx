"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { api } from "./api";

// Registers an approval the client gave OUTSIDE the portal. It is stored as
// "aprobación externa registrada por Stroka", never as the client's own action.
export default function ExternalApproval({ contentId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!window.confirm("¿Registrar esta aprobación externa? El contenido pasa a “Aprobado”.")) return;
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await api(`/api/studio/content/${contentId}/external-approval`, "POST", f);
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo registrar.");
    setOpen(false);
    router.refresh();
  }

  if (!open) return <Button variant="line" onClick={() => setOpen(true)}>Registrar aprobación externa</Button>;
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 border border-edge bg-panel p-5">
      <Field label="Nombre de quien aprobó"><Input name="approverName" required maxLength={80} autoFocus /></Field>
      <Field label="Medio">
        <Select name="channel" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option></Select>
      </Field>
      <Field label="Nota interna (opcional)" hint="Solo Studio; el cliente no la ve."><Textarea name="note" rows={2} maxLength={500} /></Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="solid" disabled={busy}>{busy ? "Registrando…" : "Registrar"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
