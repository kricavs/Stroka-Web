"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUSES } from "@/lib/studio/config";
import { formatDate, formatMoney } from "@/lib/studio/calc";
import { Button } from "./ui";

export const STATUS_STYLE = {
  BORRADOR: "border-bone/25 text-ash",
  ENVIADO: "border-champagne/60 text-champagne",
  APROBADO: "border-emerald-400/50 text-emerald-300",
  RECHAZADO: "border-red-400/50 text-red-300",
};

export default function BudgetList({ initial }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");

  async function call(url, opts) {
    setError("");
    const res = await fetch(url, opts);
    if (!res.ok) {
      setError("La operación falló. Reintentá.");
      return null;
    }
    return res.json();
  }

  async function changeStatus(id, status) {
    if (await call(`/api/studio/budgets/${id}/status`, jsonPost({ status }))) {
      setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    }
  }
  async function duplicate(id) {
    const data = await call(`/api/studio/budgets/${id}/duplicate`, { method: "POST" });
    if (data) router.push(`/studio/presupuestos/${data.budget.id}`);
  }
  async function remove(id) {
    if (await call(`/api/studio/budgets/${id}`, { method: "DELETE" })) {
      setRows((r) => r.filter((x) => x.id !== id));
      setConfirmId(null);
    }
  }

  if (!rows.length) {
    return <p className="mt-16 text-sm text-ash">No hay presupuestos todavía.</p>;
  }

  return (
    <div className="mt-8">
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-[0.62rem] uppercase tracking-wider2 text-ash">
              {["Número", "Cliente", "Proyecto", "Fecha", "Total", "Estado", ""].map((h) => (
                <th key={h} className="px-3 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b hairline align-middle hover:bg-bone/[0.03]">
                <td className="px-3 py-4 font-display tracking-wider2">
                  <Link href={`/studio/presupuestos/${r.id}`} className="hover:text-champagne">{r.number}</Link>
                </td>
                <td className="px-3 py-4">{r.clientName}</td>
                <td className="px-3 py-4 text-bone/80">{r.projectName}</td>
                <td className="whitespace-nowrap px-3 py-4 text-ash">{formatDate(r.date)}</td>
                <td className="whitespace-nowrap px-3 py-4">
                  {r.type === "plans" ? <span className="text-ash">Planes</span> : `${formatMoney(r.total, r.currency)}`}
                  <span className="ml-2 text-[0.6rem] tracking-wider2 text-ash">{r.currency}</span>
                </td>
                <td className="px-3 py-4">
                  <select
                    aria-label="Estado"
                    value={r.status}
                    onChange={(e) => changeStatus(r.id, e.target.value)}
                    className={`border bg-ink px-2 py-1 text-[0.62rem] uppercase tracking-wider2 ${STATUS_STYLE[r.status]}`}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right text-[0.65rem] uppercase tracking-wider2">
                  {confirmId === r.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-ash">¿Eliminar?</span>
                      <Button variant="danger" className="!px-3 !py-1.5" onClick={() => remove(r.id)}>Sí, eliminar</Button>
                      <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => setConfirmId(null)}>Cancelar</Button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-4 text-ash">
                      <Link href={`/studio/presupuestos/${r.id}`} className="hover:text-bone">Editar</Link>
                      <button onClick={() => duplicate(r.id)} className="uppercase tracking-wider2 hover:text-bone">Duplicar</button>
                      <button onClick={() => setConfirmId(r.id)} className="uppercase tracking-wider2 hover:text-red-300">Eliminar</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const jsonPost = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
