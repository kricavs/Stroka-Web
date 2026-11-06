"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select } from "../ui";
import { DEFAULT_TIME, IMPORT_STATUSES } from "@/lib/planner/rules.js";
import { MAX_XLSX_BYTES, MB } from "@/lib/planner/limits.js";
import { PLATFORMS } from "@/lib/shared/content.js";

// Step 1–2: file + settings → analyze. Creates a DRAFT only; the calendar is untouched.
export default function PlannerUpload({ clientId, clientName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return setError("Elegí un archivo .xlsx.");
    if (!/\.xlsx$/i.test(file.name)) return setError("Solo se aceptan archivos .xlsx.");
    if (file.size > MAX_XLSX_BYTES) return setError(`El archivo supera el máximo de ${MAX_XLSX_BYTES / MB} MB.`);
    if (!data.get("platform")) return setError("Elegí la plataforma: el Excel no la trae y no la adivinamos.");
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/clients/${clientId}/planner/analyze`, { method: "POST", body: data });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "No se pudo analizar el archivo.");
      router.push(`/studio/clientes/${clientId}/importar/${out.id}`);
    } catch (err) {
      setError(err.message || "No se pudo analizar el archivo.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 border border-edge bg-panel p-5">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">1 · Archivo y configuración</p>
      <Field label="Planificación (.xlsx)" hint={`Hasta ${MAX_XLSX_BYTES / MB} MB. Se lee y se descarta: el archivo no se guarda. Sin macros ni .xls.`}>
        <Input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plataforma por defecto" hint="El Excel no trae plataforma. Se aplica a todas las piezas.">
          <Select name="platform" defaultValue="" required>
            <option value="" disabled>Elegí una…</option>
            {PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Estado al importar" hint="Las ideas no cuentan para el objetivo mensual; «En producción» sí.">
          <Select name="status" defaultValue="production">
            {IMPORT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Hora para piezas sin hora" hint="Hora de Buenos Aires. Se muestra como «Sin hora» en la revisión y se puede cambiar pieza por pieza.">
          <Input type="time" name="time" defaultValue={DEFAULT_TIME} required />
        </Field>
      </div>
      <p className="text-xs font-light text-ash">
        Se creará un <strong className="font-medium text-bone">borrador</strong> de {clientName} para revisar. El calendario no cambia hasta que lo apliques.
      </p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="solid" disabled={busy}>{busy ? "Analizando…" : "Analizar"}</Button>
    </form>
  );
}
