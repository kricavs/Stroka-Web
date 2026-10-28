"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/studio/calc";
import { Button } from "./ui";

const LABEL = { pending: "Pendiente", published: "Publicada", hidden: "Oculta", rejected: "Rechazada" };
const STYLE = {
  pending: "border-champagne bg-champagne font-semibold !text-ink",
  published: "border-champagne text-champagne",
  hidden: "border-[#55524d] text-ash",
  rejected: "border-[#a0615a] text-[#d49a92]",
};
const ORDER = ["pending", "published", "hidden", "rejected"];

export default function TestimonialsAdmin({ initial }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");

  const pending = rows.filter((r) => r.status === "pending").length;

  async function call(url, opts) {
    setError("");
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    if (!res.ok) setError("La operación falló. Reintentá.");
    return res.ok;
  }

  async function setStatus(id, status) {
    if (!(await call(`/api/studio/testimonials/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }))) return;
    setRows((list) => {
      const max = Math.max(-1, ...list.filter((r) => r.status === "published").map((r) => r.sortOrder));
      const next = list.map((r) =>
        r.id === id ? { ...r, status, sortOrder: status === "published" && r.status !== "published" ? max + 1 : r.sortOrder } : r
      );
      return sortRows(next);
    });
    router.refresh(); // keeps the pending badge in the Studio nav in sync
  }

  async function remove(id) {
    if (await call(`/api/studio/testimonials/${id}`, { method: "DELETE" })) {
      setRows((l) => l.filter((r) => r.id !== id));
      setConfirmId(null);
      router.refresh();
    }
  }

  async function move(id, d) {
    const pub = rows.filter((r) => r.status === "published");
    const i = pub.findIndex((r) => r.id === id);
    const j = i + d;
    if (j < 0 || j >= pub.length) return;
    [pub[i], pub[j]] = [pub[j], pub[i]];
    const ok = await call("/api/studio/testimonials/reorder", { method: "POST", body: JSON.stringify({ ids: pub.map((r) => r.id) }) });
    if (!ok) return;
    const pos = new Map(pub.map((r, k) => [r.id, k]));
    setRows((l) => sortRows(l.map((r) => (pos.has(r.id) ? { ...r, sortOrder: pos.get(r.id) } : r))));
  }

  const actions = (r) => {
    const btn = (label, status, variant = "line") => (
      <Button key={label} type="button" variant={variant} onClick={() => setStatus(r.id, status)}>{label}</Button>
    );
    if (r.status === "pending") return [btn("Aprobar", "published", "solid"), btn("Rechazar", "rejected")];
    if (r.status === "published") return [btn("Ocultar", "hidden")];
    return [btn("Volver a publicar", "published")];
  };

  const published = rows.filter((r) => r.status === "published");

  return (
    <div className="mt-8">
      <p className={`text-sm ${pending ? "text-champagne" : "text-ash"}`} role="status">
        {pending === 0 ? "No hay referencias pendientes." : `${pending} ${pending === 1 ? "referencia pendiente" : "referencias pendientes"} de revisión.`}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      {!rows.length && <p className="mt-12 text-sm text-ash">Todavía no se envió ninguna referencia.</p>}

      <ul className="mt-6 divide-y divide-edge border-y border-edge">
        {rows.map((r) => {
          const pi = published.findIndex((x) => x.id === r.id);
          return (
            <li key={r.id} className={`grid gap-4 py-5 md:grid-cols-[1fr_auto] ${r.status === "pending" ? "bg-champagne/[0.04]" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`border px-2 py-0.5 text-[0.6rem] uppercase tracking-wider2 ${STYLE[r.status]}`}>{LABEL[r.status]}</span>
                  <span className="text-xs text-ash">{formatDate(String(r.createdAt).slice(0, 10))}</span>
                </div>
                <p className="mt-3 whitespace-pre-line font-display text-lg font-light leading-snug">“{r.comment}”</p>
                <p className="mt-3 text-sm">
                  <span className="uppercase tracking-wider2">{r.brand}</span>
                  <span className="text-ash"> — {r.person}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2 md:justify-end">
                {r.status === "published" && (
                  <>
                    <Button type="button" variant="ghost" disabled={pi === 0} onClick={() => move(r.id, -1)} aria-label="Subir">↑</Button>
                    <Button type="button" variant="ghost" disabled={pi === published.length - 1} onClick={() => move(r.id, 1)} aria-label="Bajar">↓</Button>
                  </>
                )}
                {actions(r)}
                {confirmId === r.id ? (
                  <>
                    <Button type="button" variant="danger" onClick={() => remove(r.id)}>Confirmar</Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmId(null)}>Cancelar</Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setConfirmId(r.id)}>Eliminar</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function sortRows(list) {
  return [...list].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      (a.status === "published" ? a.sortOrder - b.sortOrder : new Date(b.createdAt) - new Date(a.createdAt))
  );
}
