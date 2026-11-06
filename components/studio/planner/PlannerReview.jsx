"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "../ui";
import MonthPreview from "./MonthPreview";
import { api } from "../api";
import { ACTION_LABEL, DEFAULT_TIME, IMPORT_STATUSES } from "@/lib/planner/rules.js";
import { PLATFORM_LABEL, TYPE_LABEL } from "@/lib/shared/content.js";
import { formatDayShort, formatMonthLong, formatSlot, parseYmd, weekStart } from "@/lib/shared/time.js";

const ACTION_COLOR = { create: "#6fbf8e", update: "#4fb3c8", no_change: "#8a8a8f", conflict: "#e5604d", possible_duplicate: "#d9a441", skip: "#8a8a8f" };
const LEVEL_COLOR = { error: "#e5604d", warning: "#d9a441" };
const FORMAT_OPTIONS = ["Reel", "Carrusel", "Historia", "Pieza única", "Video", "Short", "Artículo"];
const FIELD_LABEL = { title: "Título", content_type: "Tipo", platform: "Plataforma", scheduled_at: "Fecha y hora", internal_notes: "Notas internas", pillar: "Pilar", cta: "CTA" };
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const dayLabel = (date) => (date ? `${DOW[new Date(`${date}T12:00:00Z`).getUTCDay()]} ${formatDayShort(new Date(`${date}T15:00:00Z`))}` : "Sin fecha");
function show(field, v) {
  if (v == null || v === "") return "—";
  if (field === "scheduled_at") return formatSlot(new Date(v));
  if (field === "content_type") return TYPE_LABEL[v] || v;
  if (field === "platform") return PLATFORM_LABEL[v] || v;
  return String(v);
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function PlannerReview({ draft, clientId }) {
  const router = useRouter();
  const editable = draft.status === "draft";
  const s = draft.summary || {};
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/api/studio/clients/${clientId}/planner/drafts/${draft.id}`;

  const byType = (t) => draft.items.filter((i) => i.contentType === t).length;
  const reels = byType("reel"), carousels = byType("carousel"), stories = byType("story");
  const others = draft.items.length - reels - carousels - stories;
  const blocked = (s.errors || 0) > 0 || (s.unresolvedConflicts || 0) > 0;
  const status = IMPORT_STATUSES.find(([k]) => k === draft.defaultContentStatus)?.[1] || draft.defaultContentStatus;

  async function patch(itemId, body) {
    setError("");
    const r = await api(`${base}/items/${itemId}`, "PATCH", body);
    if (!r.ok) { setError(r.data.error || "No se pudo guardar."); return false; }
    router.refresh();
    return true;
  }
  async function run(path, after) {
    setBusy(true); setError("");
    const r = await api(`${base}/${path}`, "POST");
    setBusy(false);
    if (!r.ok) { setConfirm(false); return setError(r.data.error || "No se pudo completar la acción."); }
    after?.();
    router.refresh();
  }

  const calendarHref = `/studio/clientes/${clientId}?tab=calendario&date=${draft.period}-01`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">{draft.clientName} · {formatMonthLong(draft.period)}</p>
        <p className="mt-2 text-sm font-light text-ash">
          {draft.sourceName || "Planificación"} · {draft.status === "applied" ? "Aplicada" : draft.status === "cancelled" ? "Cancelada" : "Borrador para revisar"}
        </p>
      </header>

      {draft.previous.length > 0 && (
        <p className="border border-edge bg-panel p-3 text-sm font-light" role="status">
          Este archivo ya fue importado
          {draft.previous[0].appliedAt ? ` el ${formatSlot(new Date(draft.previous[0].appliedAt))}` : ""}.{" "}
          <Link href={`/studio/clientes/${clientId}/importar/${draft.previous[0].id}`} className="text-champagne hover:underline">Ver esa importación</Link>
          . Si no cambió nada, esta tendrá todo «sin cambios» y no duplicará contenidos.
        </p>
      )}
      {draft.issues.length > 0 && (
        <ul className="space-y-1 text-xs font-light text-ash">
          {draft.issues.map((i, k) => <li key={k} style={{ color: LEVEL_COLOR[i.level] }}>{i.text}</li>)}
        </ul>
      )}

      <section className="grid gap-x-8 gap-y-3 border border-edge bg-panel p-5 text-sm font-light sm:grid-cols-3">
        <div><p className="text-[0.58rem] uppercase tracking-wider2 text-ash">Plataforma</p><p>{PLATFORM_LABEL[draft.defaultPlatform]}</p></div>
        <div><p className="text-[0.58rem] uppercase tracking-wider2 text-ash">Estado al importar</p><p>{status}</p>
          {draft.defaultContentStatus === "idea" && <p className="mt-1 text-xs text-[#d9a441]">Las ideas no cuentan para el objetivo mensual.</p>}
        </div>
        <div><p className="text-[0.58rem] uppercase tracking-wider2 text-ash">Piezas sin hora</p><p>Se cargan a las {draft.defaultTime || DEFAULT_TIME} (Buenos Aires)</p></div>
      </section>

      <section>
        <h2 className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Resumen</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {[["Detectados", draft.items.length], ["Reels", reels], ["Carruseles", carousels], ["Historias", stories], ["Otras piezas", others], ["Advertencias", s.warnings || 0], ["Errores", s.errors || 0], ["Conflictos", s.unresolvedConflicts || 0]].map(([l, n]) => (
            <div key={l} className="border-t border-edge pt-3">
              <dd className="font-title text-3xl leading-none" style={{ color: l === "Errores" && n ? LEVEL_COLOR.error : l === "Advertencias" && n ? LEVEL_COLOR.warning : undefined }}>{n}</dd>
              <dt className="mt-2 text-[0.58rem] uppercase tracking-wider2 text-ash">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <MonthPreview period={draft.period} items={draft.items} />
        <div>
          <h2 className="mb-3 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Notas del mes</h2>
          {draft.notes.length === 0 ? <p className="text-sm font-light text-ash">El archivo no trae notas.</p> : (
            <ul className="divide-y divide-edge border border-edge">
              {draft.notes.map((n, i) => (
                <li key={i} className="p-3 text-sm font-light">
                  <p className="text-[0.6rem] font-medium uppercase tracking-wider2 text-champagne">{n.topic}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-ash">{n.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs font-light text-ash/70">Son contexto: no se convierten en contenidos ni tareas.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Piezas</h2>
        <div className="space-y-5">
          {weekGroups(draft.items).map((g) => (
            <div key={g.key}>
              <h3 className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ash">{g.label}</h3>
              <ul className="divide-y divide-edge border border-edge">
                {g.items.map((it) => (
                  <ItemRow key={`${it.id}-${it.title}-${it.date}-${it.time}-${it.format}-${it.skipped}`} it={it} editable={editable} onPatch={patch} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        {draft.orphans.length > 0 && (
          <p className="mt-3 text-xs font-light text-ash">
            {plural(draft.orphans.length, "contenido importado antes ya no figura", "contenidos importados antes ya no figuran")} en este archivo ({draft.orphans.map((o) => o.code).join(", ")}). Se dejan como están: nada se borra.
          </p>
        )}
      </section>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {editable && (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-edge bg-ink/95 px-1 py-4 backdrop-blur">
          <Button variant="solid" disabled={blocked || busy} onClick={() => setConfirm(true)}>Aplicar al calendario</Button>
          <Button variant="ghost" disabled={busy} onClick={() => run("cancel", () => router.push(`/studio/clientes/${clientId}?tab=calendario`))}>Cancelar borrador</Button>
          {blocked && (
            <span className="text-xs font-light text-ash">
              {(s.errors || 0) > 0 ? `${plural(s.errors, "pieza con error", "piezas con errores")} (corregila u omitila)` : ""}
              {(s.errors || 0) > 0 && (s.unresolvedConflicts || 0) > 0 ? " · " : ""}
              {(s.unresolvedConflicts || 0) > 0 ? `${plural(s.unresolvedConflicts, "conflicto sin resolver", "conflictos sin resolver")}` : ""}
            </span>
          )}
        </div>
      )}
      {draft.status === "applied" && (
        <p className="border border-edge bg-panel p-4 text-sm font-light">
          Aplicada el {formatSlot(new Date(draft.appliedAt))}: {plural(s.created || 0, "contenido creado", "contenidos creados")}, {s.updated || 0} actualizados, {s.skipped || 0} omitidos{(s.noChange || 0) ? `, ${s.noChange} sin cambios` : ""}.{" "}
          <Link href={calendarHref} className="text-champagne hover:underline">Ver el calendario</Link>
        </p>
      )}
      {draft.status === "cancelled" && <p className="text-sm font-light text-ash">Borrador cancelado. El calendario no se modificó.</p>}

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar importación" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-4 border border-edge bg-panel p-6">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Aplicar al calendario</p>
            <ul className="space-y-1 text-sm font-light">
              <li>Se crearán <strong className="font-medium">{s.create || 0}</strong> contenidos</li>
              <li>Se actualizarán <strong className="font-medium">{s.update || 0}</strong></li>
              <li>Se omitirán <strong className="font-medium">{s.skip || 0}</strong>{s.duplicatesSkipped ? ` (${plural(s.duplicatesSkipped, "posible duplicado", "posibles duplicados")})` : ""}</li>
              <li>{s.noChange || 0} sin cambios · {s.unresolvedConflicts || 0} conflictos</li>
            </ul>
            <p className="text-xs font-light text-ash">Todo se aplica junto o no se aplica nada. Estado inicial: {status}.</p>
            <div className="flex gap-3">
              <Button variant="solid" disabled={busy} onClick={() => run("apply", () => setConfirm(false))}>{busy ? "Aplicando…" : "Confirmar"}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Volver</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Visual grouping only (Monday-based weeks, SEMANA 1…N in date order); data is untouched.
function weekGroups(items) {
  const by = new Map();
  for (const it of items) {
    const key = it.date && parseYmd(it.date) ? weekStart(it.date) : "none";
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(it);
  }
  const keys = [...by.keys()].filter((k) => k !== "none").sort();
  const groups = keys.map((k, i) => ({ key: k, label: `SEMANA ${i + 1}`, items: by.get(k) }));
  if (by.has("none")) groups.push({ key: "none", label: "SIN FECHA", items: by.get("none") });
  return groups;
}

function ItemRow({ it, editable, onPatch }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const action = it.skipped ? "skip" : it.action;
  const applied = it.appliedSnapshot?.outcome;

  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    const ok = await onPatch(it.id, {
      title: f.get("title"), date: f.get("date"), time: f.get("time") || null, format: f.get("format"),
      pillar: f.get("pillar"), cta: f.get("cta"), detail: f.get("detail"),
    });
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <li className={`p-4 ${it.skipped ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-28 shrink-0">
          <p className="text-sm">{dayLabel(it.date)}</p>
          <p className="text-xs text-ash">{it.time || "Sin hora"}</p>
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex flex-wrap items-center gap-x-2 text-[0.62rem] uppercase tracking-wider2 text-ash">
            <span>{it.format || "—"}</span>{it.externalCode && <span className="text-champagne">{it.externalCode}</span>}
          </p>
          <p className="mt-0.5 break-words text-sm">{it.title || <span className="text-ash">Sin título</span>}</p>
          {(it.pillar || it.cta) && <p className="mt-0.5 break-words text-xs font-light text-ash">{[it.pillar, it.cta].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em]" style={{ color: ACTION_COLOR[action] }}>
            {applied ? ({ create: "Creada", update: "Actualizada", no_change: "Sin cambios", skip: "Omitida" }[applied] || ACTION_LABEL[action]) : ACTION_LABEL[action]}
          </span>
          {editable && (
            <>
              <button type="button" className="text-[0.62rem] uppercase tracking-wider2 text-ash hover:text-champagne" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Cerrar" : "Editar"}</button>
              <button type="button" className="text-[0.62rem] uppercase tracking-wider2 text-ash hover:text-champagne" onClick={() => onPatch(it.id, { skipped: !it.skipped })}>{it.skipped ? "Incluir" : "Omitir"}</button>
            </>
          )}
        </div>
      </div>

      {it.issues.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {it.issues.map((i, k) => <li key={k} className="text-xs font-light" style={{ color: LEVEL_COLOR[i.level] }}>{i.level === "error" ? "Error: " : ""}{i.text}</li>)}
        </ul>
      )}

      {editable && !it.skipped && it.action === "possible_duplicate" && (
        <div className="mt-3 border border-edge p-3 text-xs font-light">
          <p>Ya hay un contenido parecido ese día: «{it.analysis.duplicateTitle}». {it.resolution === "create" ? "Se creará igual." : "Por defecto se omite."}</p>
          <div className="mt-2 flex gap-3">
            <Button className="!px-3 !py-1.5" variant={it.resolution === "create" ? "solid" : "line"} onClick={() => onPatch(it.id, { resolution: "create" })}>Crear igual</Button>
            <Button className="!px-3 !py-1.5" variant={it.resolution !== "create" ? "solid" : "line"} onClick={() => onPatch(it.id, { resolution: "skip" })}>Omitir</Button>
          </div>
        </div>
      )}

      {editable && !it.skipped && it.action === "conflict" && (
        <div className="mt-3 border border-[#e5604d]/50 p-3 text-xs font-light">
          <p className="mb-2 text-[#e5604d]">Editado en Studio desde la última importación y el Excel también cambió. Elegí cuál conservar.</p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr_1fr]">
            <span /><dt className="text-[0.58rem] uppercase tracking-wider2 text-ash">Studio</dt><dt className="text-[0.58rem] uppercase tracking-wider2 text-ash">Excel</dt>
            {(it.analysis.diff || []).map((f) => (
              <div key={f} className="contents">
                <dd className="text-ash">{FIELD_LABEL[f]}</dd>
                <dd className="break-words whitespace-pre-line">{show(f, it.analysis.current?.[f])}</dd>
                <dd className="break-words whitespace-pre-line">{show(f, it.analysis.excel?.[f])}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex gap-3">
            <Button className="!px-3 !py-1.5" variant={it.resolution === "studio" ? "solid" : "line"} onClick={() => onPatch(it.id, { resolution: "studio" })}>Conservar Studio</Button>
            <Button className="!px-3 !py-1.5" variant={it.resolution === "excel" ? "solid" : "line"} onClick={() => onPatch(it.id, { resolution: "excel" })}>Usar Excel</Button>
          </div>
        </div>
      )}

      {editable && open && (
        <form onSubmit={save} className="mt-3 grid gap-3 border border-edge p-3 sm:grid-cols-2">
          <Field label="Título" className="sm:col-span-2"><Input name="title" defaultValue={it.title} maxLength={200} required /></Field>
          <Field label="Fecha"><Input type="date" name="date" defaultValue={it.date || ""} /></Field>
          <Field label="Hora (opcional)"><Input type="time" name="time" defaultValue={it.time || ""} /></Field>
          <Field label="Formato">
            <Select name="format" defaultValue={it.format}>
              {!FORMAT_OPTIONS.includes(it.format) && <option value={it.format}>{it.format || "—"}</option>}
              {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Pilar"><Input name="pillar" defaultValue={it.pillar || ""} maxLength={120} /></Field>
          <Field label="CTA" className="sm:col-span-2"><Input name="cta" defaultValue={it.cta || ""} maxLength={300} /></Field>
          <Field label="Detalle / enfoque" className="sm:col-span-2"><Textarea name="detail" rows={4} defaultValue={it.detail || ""} maxLength={3000} /></Field>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" variant="solid" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </li>
  );
}
