"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, PROPOSAL_TYPES, STATUSES } from "@/lib/studio/config";
import { computeTotals, emptyBudget, formatMoney, hydrate } from "@/lib/studio/calc";
import { validateBudget } from "@/lib/studio/validate";
import { pdfFileName, renderBudgetPdf } from "@/lib/studio/pdf/render";
import { Button, Field, Input, Section, Select, Textarea } from "./ui";
import { ItemsEditor, PlansEditor, SimpleEditor } from "./TypeEditors";

const PdfPreview = dynamic(() => import("./PdfPreview"), {
  ssr: false,
  loading: () => <div className="min-h-[70vh] bg-graphite" />,
});

export default function BudgetEditor({ initial }) {
  const router = useRouter();
  // Hydrate once: it generates random ids, so two calls would never compare equal.
  const [start] = useState(() => (initial ? hydrate(initial) : emptyBudget("detailed")));
  const [b, setB] = useState(start);
  const [saved, setSaved] = useState(() => (initial ? JSON.stringify(start) : null));
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("edit"); // mobile/tablet: edit | preview

  const set = (patch) => setB((prev) => ({ ...prev, ...patch }));
  const totals = useMemo(() => computeTotals(b), [b]);
  const live = useMemo(() => ({ ...b, ...totals }), [b, totals]);
  const dirty = saved !== JSON.stringify(b);
  const liveErrors = useMemo(() => validateBudget(b).errors, [b]);

  useEffect(() => {
    const h = (e) => dirty && (e.preventDefault(), (e.returnValue = ""));
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  async function save() {
    setErrors([]);
    if (liveErrors.length) return setErrors(liveErrors), false;
    setBusy("save");
    const res = await fetch(b.id ? `/api/studio/budgets/${b.id}` : "/api/studio/budgets", {
      method: b.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setErrors(data.errors || [data.error || "No se pudo guardar"]), false;
    const next = hydrate(data.budget);
    setB(next);
    setSaved(JSON.stringify(next));
    if (!b.id) router.replace(`/studio/presupuestos/${data.budget.id}`);
    return next;
  }

  async function download() {
    setErrors([]);
    // Ensure the exported file carries the real, saved number.
    const target = dirty || !b.id ? await save() : b;
    if (!target) return;
    setBusy("pdf");
    try {
      const blob = await renderBudgetPdf(target);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = pdfFileName(target);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      console.error(e);
      setErrors(["No se pudo generar el PDF."]);
    }
    setBusy("");
  }

  const editor = (
    <div className="space-y-8 pb-24">
      <Section title="General">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente *"><Input value={b.clientName} onChange={(e) => set({ clientName: e.target.value })} /></Field>
          <Field label="Proyecto *"><Input value={b.projectName} onChange={(e) => set({ projectName: e.target.value })} /></Field>
          <Field label="Tipo de propuesta">
            <Select value={b.type} onChange={(e) => set({ type: e.target.value })}>
              {PROPOSAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Moneda">
            <Select value={b.currency} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha del presupuesto"><Input type="date" value={b.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Validez (días)"><Input type="number" min={1} max={730} value={b.validDays} onChange={(e) => set({ validDays: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title={b.type === "plans" ? "Planes (2 o 3)" : b.type === "simple" ? "Servicio" : "Servicios"}>
        {b.type === "detailed" && <ItemsEditor b={b} set={set} />}
        {b.type === "plans" && <PlansEditor b={b} set={set} />}
        {b.type === "simple" && <SimpleEditor b={b} set={set} />}
      </Section>

      {b.type !== "plans" && (
        <Section title="Descuento y total">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Descuento">
              <Select value={b.discount.kind} onChange={(e) => set({ discount: { kind: e.target.value, value: 0 } })}>
                <option value="none">Sin descuento</option>
                <option value="percent">Porcentaje (%)</option>
                <option value="amount">Monto fijo</option>
              </Select>
            </Field>
            {b.discount.kind !== "none" && (
              <Field label={b.discount.kind === "percent" ? "Porcentaje" : "Monto"}>
                <Input type="number" min={0} step="any" value={b.discount.value} onChange={(e) => set({ discount: { ...b.discount, value: e.target.value } })} />
              </Field>
            )}
          </div>
          <dl className="mt-5 space-y-1.5 border-t hairline pt-4 text-sm">
            <Row k="Subtotal" v={formatMoney(totals.subtotal, b.currency)} />
            {totals.discountAmount > 0 && <Row k="Descuento" v={`– ${formatMoney(totals.discountAmount, b.currency)}`} />}
            <div className="flex items-baseline justify-between pt-2">
              <dt className="text-[0.62rem] uppercase tracking-wider2 text-champagne">Total</dt>
              <dd className="font-display text-3xl">{formatMoney(totals.total, b.currency)}</dd>
            </div>
          </dl>
        </Section>
      )}

      <Section title="Pago y condiciones">
        <div className="space-y-3">
          <Field label="Forma de pago"><Textarea rows={3} value={b.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field>
          <Field label="Condiciones"><Textarea rows={5} value={b.conditions} onChange={(e) => set({ conditions: e.target.value })} /></Field>
          <Field label="Nota visible para el cliente"><Textarea rows={3} value={b.clientNote} onChange={(e) => set({ clientNote: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Notas internas (no salen en el PDF)">
        <Textarea rows={3} value={b.internalNote} onChange={(e) => set({ internalNote: e.target.value })} />
      </Section>
    </div>
  );

  return (
    <div>
      <div className="z-20 -mx-5 mb-6 flex flex-wrap items-center justify-between gap-3 border-b hairline bg-ink/95 px-5 py-3 backdrop-blur md:sticky md:top-0 md:-mx-8 md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/studio/presupuestos" className="text-[0.65rem] uppercase tracking-wider2 text-ash hover:text-bone">← Historial</Link>
          <span className="font-display tracking-wider2">{b.number || "NUEVO PRESUPUESTO"}</span>
          {dirty && <span className="text-[0.6rem] uppercase tracking-wider2 text-champagne">Sin guardar</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Estado" value={b.status} onChange={(e) => set({ status: e.target.value })} className="!w-auto !py-2 text-[0.65rem] uppercase tracking-wider2">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Button onClick={save} disabled={!!busy || (!dirty && !!b.id)}>{busy === "save" ? "Guardando…" : "Guardar"}</Button>
          <Button variant="solid" onClick={download} disabled={!!busy}>{busy === "pdf" ? "Generando…" : "Descargar PDF"}</Button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="mb-6 space-y-1 border border-red-400/40 bg-red-400/5 p-4 text-sm text-red-300">
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}

      <div className="mb-5 flex gap-2 xl:hidden">
        {[["edit", "Editar"], ["preview", "Vista previa"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 border px-3 py-2 text-[0.65rem] uppercase tracking-wider2 ${tab === k ? "border-champagne text-champagne" : "border-bone/20 text-ash"}`}>{l}</button>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={tab === "edit" ? "" : "hidden xl:block"}>{editor}</div>
        <div className={`${tab === "preview" ? "" : "hidden xl:block"}`}>
          <div className="xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)]">
            <PdfPreview budget={live} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[0.62rem] uppercase tracking-wider2 text-ash">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
