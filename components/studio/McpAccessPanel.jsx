"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "./ui";
import { api } from "./api";
import { formatStamp } from "@/lib/shared/time.js";

// The plaintext token lives ONLY in this component's state right after creating or
// regenerating. It is not stored and can't be retrieved again.
export default function McpAccessPanel({ clientId, clientName, tokens }) {
  const router = useRouter();
  const [form, setForm] = useState(null); // { label, canWrite }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const stamp = (d) => (d ? formatStamp(new Date(d)) : "—");
  const base = `/api/studio/clients/${clientId}/mcp-tokens`;

  async function run(fn) {
    setBusy(true);
    setError("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo completar la acción.");
    return r.data;
  }

  async function create() {
    const out = await run(() => api(base, "POST", { label: form.label, canWrite: form.canWrite }));
    if (!out) return;
    setIssued(out);
    setCopied(false);
    setForm(null);
    router.refresh();
  }
  async function revoke(t) {
    if (!window.confirm(`¿Revocar “${t.label}”? Claude perderá el acceso de inmediato.`)) return;
    if (await run(() => api(`${base}/${t.id}`, "DELETE"))) router.refresh();
  }
  async function regenerate(t) {
    if (!window.confirm(`¿Regenerar “${t.label}”? El token actual dejará de funcionar y vas a ver el nuevo una sola vez.`)) return;
    const out = await run(() => api(`${base}/${t.id}`, "POST"));
    if (!out) return;
    setIssued({ ...out, regenerated: true });
    setCopied(false);
    router.refresh();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setError("No se pudo copiar automáticamente: seleccioná el token y copialo a mano.");
    }
  }

  const active = tokens.filter((t) => t.active);
  const revoked = tokens.filter((t) => !t.active);

  return (
    <section className="max-w-2xl space-y-6 border-t border-edge pt-8">
      <div>
        <h2 className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Claude / MCP</h2>
        <p className="mt-2 text-sm font-light text-ash">
          Cada acceso conecta un proyecto de Claude con <strong className="font-medium text-bone">{clientName}</strong> y nada más. Claude lee y modifica el calendario y las tareas de este cliente; Studio sigue siendo la fuente de verdad.
        </p>
      </div>

      {issued && (
        <div className="border border-champagne bg-graphite p-6" role="status">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-champagne">
            {issued.regenerated ? "Acceso regenerado" : "Acceso generado"} · {issued.label}
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Token MCP</dt><dd className="mt-1 break-all select-all font-mono text-sm">{issued.token}</dd></div>
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">URL del conector</dt><dd className="mt-1 select-all">{issued.url}</dd></div>
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Header</dt><dd className="mt-1 break-all select-all font-mono text-xs">Authorization: Bearer {issued.token.slice(0, 12)}…</dd></div>
          </dl>
          <p className="mt-4 text-xs text-[#e0a35f]">Este token solo se mostrará una vez. Al salir de esta pantalla no vas a poder volver a verlo.</p>
          {issued.regenerated && <p className="mt-1 text-xs text-ash">El token anterior ya no funciona.</p>}
          <div className="mt-5 flex items-center gap-4">
            <Button variant="solid" onClick={copy}>{copied ? "Copiado ✓" : "Copiar token"}</Button>
            <Button variant="ghost" onClick={() => setIssued(null)}>Ya lo guardé</Button>
          </div>
        </div>
      )}

      {active.length === 0 && <p className="text-sm font-light text-ash">Este cliente no tiene integraciones de Claude activas.</p>}
      {active.length > 0 && (
        <ul className="divide-y divide-edge border border-edge">
          {active.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{t.label}</p>
                <p className="mt-1 text-xs text-ash">Creado {stamp(t.createdAt)} · Último uso {stamp(t.lastUsedAt)}</p>
              </div>
              <span className="border border-edge px-2 py-1 text-[0.6rem] uppercase tracking-wider2 text-ash">{t.canWrite ? "Lectura + escritura" : "Solo lectura"}</span>
              <Button variant="line" onClick={() => regenerate(t)} disabled={busy}>Regenerar</Button>
              <Button variant="danger" onClick={() => revoke(t)} disabled={busy}>Revocar</Button>
            </li>
          ))}
        </ul>
      )}

      {!form ? (
        <Button variant="solid" onClick={() => setForm({ label: `Proyecto Claude ${clientName}`, canWrite: true })} disabled={busy}>Generar acceso Claude</Button>
      ) : (
        <div className="space-y-4 border border-edge bg-panel p-5">
          <Field label="Nombre" hint="Cómo vas a reconocer este acceso, por ejemplo “Proyecto Claude Torquen”.">
            <Input value={form.label} maxLength={80} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1.5 text-[0.6rem] font-medium uppercase tracking-wider2 text-ash">Permisos</legend>
            {[[true, "Lectura + escritura"], [false, "Lectura"]].map(([v, l]) => (
              <label key={l} className="flex items-center gap-3">
                <input type="radio" name="mcp-perm" checked={form.canWrite === v} onChange={() => setForm({ ...form, canWrite: v })} className="h-4 w-4 accent-[#b9a388]" />
                {l}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-3">
            <Button variant="solid" onClick={create} disabled={busy || !form.label.trim()}>{busy ? "Generando…" : "Generar"}</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {revoked.length > 0 && (
        <details className="text-xs text-ash">
          <summary className="cursor-pointer uppercase tracking-wider2">Revocados · {revoked.length}</summary>
          <ul className="mt-3 space-y-1">{revoked.map((t) => <li key={t.id}>{t.label} · revocado {stamp(t.revokedAt)}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
