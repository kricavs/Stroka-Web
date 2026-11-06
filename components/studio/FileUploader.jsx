"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { api } from "./api";
import { FILE_CATEGORIES, FILE_TYPES, MB } from "@/lib/files/rules.js";

const accept = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",");

// Three steps: prepare (server validates + signs) → direct upload to the private
// store (dev: through our route) → complete (server re-validates the bytes).
// `base`: { id, name, category, contentId } when adding a version of an existing file.
export default function FileUploader({ clientId, contents, base, onDone }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(base));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const formRef = useRef(null);

  // The form sits above a long list: bring it into view when opened for a new version.
  useEffect(() => {
    if (base) formRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [base?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return setError("Elegí un archivo.");
    const category = String(base?.category || f.get("category"));
    setBusy(true);
    setProgress(0);
    try {
      const prep = await api("/api/studio/files/prepare", "POST", {
        clientId, category, filename: file.name, size: file.size, contentId: (base?.contentId ?? f.get("contentId")) || null,
      });
      if (!prep.ok) throw new Error(prep.data.error || "No se pudo preparar la subida.");
      const { pathname, intent, mode, contentType } = prep.data;

      if (mode === "blob") {
        await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/studio/files/upload",
          clientPayload: JSON.stringify({ intent, clientId, category }),
          contentType,
          multipart: file.size > 20 * MB,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
      } else {
        const q = new URLSearchParams({ pathname, intent, clientId, category });
        const res = await fetch(`/api/studio/files/dev-upload?${q}`, { method: "PUT", body: file });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falló la subida.");
      }

      const done = await api("/api/studio/files/complete", "POST", {
        pathname, intent, clientId, category,
        name: f.get("name") || file.name.replace(/\.[^.]+$/, ""),
        originalName: file.name,
        description: f.get("description") || undefined,
        contentId: (base?.contentId ?? f.get("contentId")) || null,
        newVersionOf: base?.id || null,
        markFinal: f.get("markFinal") === "on",
        clientVisible: f.get("clientVisible") === "on",
      });
      if (!done.ok) throw new Error(done.data.error || "No se pudo registrar el archivo.");
      form.reset();
      setOpen(false);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err.message || "Falló la subida.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!open) return <Button variant="solid" onClick={() => setOpen(true)}>Subir archivo</Button>;

  return (
    <form ref={formRef} onSubmit={submit} className="max-w-2xl space-y-4 border border-edge bg-panel p-5">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">{base ? `Nueva versión de “${base.name}”` : "Subir archivo"}</p>
      <Field label="Archivo" hint="JPG, PNG, WEBP, AVIF (hasta 25 MB) · PDF (50 MB) · ZIP (100 MB). Para videos pesados usá un link de preview.">
        <Input type="file" name="file" accept={accept} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre visible"><Input name="name" maxLength={120} defaultValue={base?.name || ""} placeholder="Logo horizontal" /></Field>
        {!base && (
          <Field label="Categoría">
            <Select name="category" defaultValue="deliverables">{FILE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          </Field>
        )}
      </div>
      {!base && (
        <Field label="Contenido relacionado (opcional)">
          <Select name="contentId" defaultValue="">
            <option value="">Ninguno</option>
            {contents.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Descripción (opcional)"><Textarea name="description" rows={2} maxLength={1000} /></Field>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="clientVisible" defaultChecked className="h-4 w-4 accent-[#b9a388]" /> Visible para el cliente</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="markFinal" className="h-4 w-4 accent-[#b9a388]" /> Entregable final</label>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {progress !== null && <p className="text-xs text-ash">Subiendo… {progress}%</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="solid" disabled={busy}>{busy ? "Subiendo…" : "Subir"}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => (base ? onDone?.() : setOpen(false))}>Cancelar</Button>
      </div>
    </form>
  );
}
