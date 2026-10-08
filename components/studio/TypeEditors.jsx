"use client";

import { lineTotal, formatMoney, uid } from "@/lib/studio/calc";
import { Button, Field, Input, Textarea } from "./ui";
import ListEditor from "./ListEditor";

const numProps = { type: "number", inputMode: "decimal", min: 0, step: "any" };

function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function ItemsEditor({ b, set }) {
  const items = b.items;
  const upd = (i, patch) => set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={it.id} className="border border-bone/10 p-4">
          <div className="mb-3 flex items-center justify-between text-[0.62rem] uppercase tracking-wider2 text-ash">
            <span className="text-champagne">Ítem {String(i + 1).padStart(2, "0")}</span>
            <span className="flex gap-3">
              <button disabled={i === 0} onClick={() => set({ items: move(items, i, -1) })} className="uppercase hover:text-bone disabled:opacity-30">Subir</button>
              <button disabled={i === items.length - 1} onClick={() => set({ items: move(items, i, 1) })} className="uppercase hover:text-bone disabled:opacity-30">Bajar</button>
              <button disabled={items.length === 1} onClick={() => set({ items: items.filter((_, k) => k !== i) })} className="uppercase hover:text-red-300 disabled:opacity-30">Eliminar</button>
            </span>
          </div>
          <div className="space-y-3">
            <Field label="Servicio"><Input value={it.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Producción fotográfica" /></Field>
            <Field label="Detalle (opcional)"><Textarea rows={2} value={it.detail} onChange={(e) => upd(i, { detail: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cantidad"><Input {...numProps} value={it.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></Field>
              <Field label="Precio unitario"><Input {...numProps} value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: e.target.value })} /></Field>
              <div>
                <span className="mb-1.5 block text-[0.62rem] uppercase tracking-wider2 text-ash">Importe</span>
                <p className="py-2.5 font-display text-lg">{formatMoney(lineTotal(it), b.currency)}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Button onClick={() => set({ items: [...items, { id: uid(), description: "", detail: "", quantity: 1, unitPrice: 0 }] })}>+ Agregar ítem</Button>
    </div>
  );
}

export function PlansEditor({ b, set }) {
  const plans = b.plans;
  const upd = (i, patch) => set({ plans: plans.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-4">
      {plans.map((p, i) => (
        <div key={p.id} className="border border-bone/10 p-4">
          <div className="mb-3 flex items-center justify-between text-[0.62rem] uppercase tracking-wider2 text-ash">
            <span className="text-champagne">Plan {String(i + 1).padStart(2, "0")}</span>
            <span className="flex gap-3">
              <button disabled={i === 0} onClick={() => set({ plans: move(plans, i, -1) })} className="uppercase hover:text-bone disabled:opacity-30">Subir</button>
              <button disabled={i === plans.length - 1} onClick={() => set({ plans: move(plans, i, 1) })} className="uppercase hover:text-bone disabled:opacity-30">Bajar</button>
              <button disabled={plans.length <= 2} onClick={() => set({ plans: plans.filter((_, k) => k !== i) })} className="uppercase hover:text-red-300 disabled:opacity-30">Eliminar</button>
            </span>
          </div>
          <div className="space-y-3">
            <Field label="Nombre"><Input value={p.name} onChange={(e) => upd(i, { name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio"><Input {...numProps} value={p.price} onChange={(e) => upd(i, { price: e.target.value })} /></Field>
              <Field label="Unidad"><Input value={p.unit} placeholder="ARS / mes" onChange={(e) => upd(i, { unit: e.target.value })} /></Field>
            </div>
            <Field label="Descripción (opcional)"><Textarea rows={2} value={p.description} onChange={(e) => upd(i, { description: e.target.value })} /></Field>
            <Field label="Prestaciones"><ListEditor values={p.features} onChange={(features) => upd(i, { features })} placeholder="Prestación incluida" addLabel="Agregar prestación" /></Field>
          </div>
        </div>
      ))}
      {plans.length < 3 && (
        <Button onClick={() => set({ plans: [...plans, { id: uid(), name: "", price: 0, unit: `${b.currency} / mes`, description: "", features: [""] }] })}>+ Agregar plan</Button>
      )}
    </div>
  );
}

export function SimpleEditor({ b, set }) {
  const s = b.simple;
  const upd = (patch) => set({ simple: { ...s, ...patch } });
  return (
    <div className="space-y-3">
      <Field label="Servicio / producción"><Input value={s.title} placeholder="Producción fotográfica comercial" onChange={(e) => upd({ title: e.target.value })} /></Field>
      <Field label="Descripción"><Textarea rows={4} value={s.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
      <Field label="Entregables"><ListEditor values={s.deliverables} onChange={(deliverables) => upd({ deliverables })} placeholder="Entregable" addLabel="Agregar entregable" /></Field>
      <Field label="Alcance"><Textarea rows={3} value={s.scope} onChange={(e) => upd({ scope: e.target.value })} /></Field>
      <Field label="Precio"><Input {...numProps} value={s.price} onChange={(e) => upd({ price: e.target.value })} /></Field>
    </div>
  );
}
