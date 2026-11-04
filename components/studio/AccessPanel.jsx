"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { api } from "./api";
import { formatAccessMessage } from "@/lib/shared/access-message.js";
import { formatStamp } from "@/lib/shared/time.js";
import ToggleActive from "./ToggleActive";

// The plaintext code lives ONLY in this component's state after a successful
// POST. It is not stored anywhere and can't be retrieved again.
export default function AccessPanel({ client, justCreated }) {
  const router = useRouter();
  const [revoke, setRevoke] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  const stamp = (d) => (d ? formatStamp(new Date(d)) : "—");

  async function generate() {
    setBusy(true);
    setError("");
    const r = await api(`/api/studio/clients/${client.id}/access`, "POST", { revokeSessions: client.has_code ? revoke : true });
    setBusy(false);
    setConfirming(false);
    if (!r.ok) return setError(r.data.error || "No se pudo generar el acceso.");
    setIssued(r.data);
    router.refresh();
  }

  async function closeSessions() {
    if (!window.confirm("¿Cerrar todas las sesiones activas de este cliente?")) return;
    setBusy(true);
    const r = await api(`/api/studio/clients/${client.id}/sessions`, "DELETE");
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo.");
    router.refresh();
  }

  async function unlock() {
    if (!window.confirm("¿Desbloquear el acceso de este cliente? No cambia el código ni cierra sesiones.")) return;
    setBusy(true);
    const r = await api(`/api/studio/clients/${client.id}/unlock`, "POST");
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo desbloquear.");
    router.refresh();
  }

  async function copy() {
    const text = formatAccessMessage({ name: issued.name, code: issued.code, url: issued.url });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("No se pudo copiar automáticamente: seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {issued && (
        <div className="border border-champagne bg-graphite p-6" role="status">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-champagne">
            {issued.regenerated ? "Acceso regenerado" : "Acceso generado"} · se muestra una sola vez
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Empresa</dt><dd className="mt-1 text-base">{issued.name}</dd></div>
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Código</dt><dd className="mt-1 select-all font-mono text-2xl tracking-widest">{issued.code}</dd></div>
            <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Portal</dt><dd className="mt-1 select-all">{issued.url}</dd></div>
          </dl>
          {issued.regenerated && <p className="mt-4 text-xs text-ash">El código anterior ya no funciona. {issued.sessionsRevoked > 0 ? `Se cerraron ${issued.sessionsRevoked} sesiones.` : "Las sesiones abiertas se mantuvieron."}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="solid" onClick={copy}>{copied ? "Copiado ✓" : "Copiar datos de acceso"}</Button>
            <span className="text-xs text-ash">Al salir de esta pantalla no vas a poder volver a verlo.</span>
          </div>
        </div>
      )}

      {!issued && justCreated && !client.has_code && (
        <p className="border border-edge bg-panel p-4 text-sm font-light text-ash">Cliente creado. El siguiente paso es generar su acceso.</p>
      )}

      <dl className="grid gap-6 sm:grid-cols-2">
        <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Estado</dt><dd className="mt-1 text-sm">{client.active ? "Activo" : "Inactivo"}</dd></div>
        <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Último acceso</dt><dd className="mt-1 text-sm">{stamp(client.last_login_at)}</dd></div>
        <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Sesiones activas</dt><dd className="mt-1 text-sm">{client.active_sessions}</dd></div>
        <div><dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Código generado</dt><dd className="mt-1 text-sm">{client.has_code ? stamp(client.code_generated_at) : "Todavía no"}</dd></div>
        {client.locked_until && new Date(client.locked_until) > new Date() && (
          <div className="sm:col-span-2 text-sm text-[#e0a35f]">Bloqueado por intentos fallidos hasta {stamp(client.locked_until)}. Usá “Desbloquear acceso”.</div>
        )}
      </dl>

      <div className="space-y-4 border-t border-edge pt-6">
        {!confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            {client.has_code ? (
              <Button variant="line" onClick={() => setConfirming(true)} disabled={busy}>Regenerar código</Button>
            ) : (
              <Button variant="solid" onClick={generate} disabled={busy}>{busy ? "Generando…" : "Generar acceso"}</Button>
            )}
            {client.has_code && <Button variant="line" onClick={unlock} disabled={busy}>Desbloquear acceso</Button>}
            {client.has_code && <Button variant="line" onClick={closeSessions} disabled={busy || client.active_sessions === 0}>Cerrar todas las sesiones</Button>}
            <ToggleActive id={client.id} active={client.active} />
          </div>
        ) : (
          <div className="space-y-4 border border-edge bg-panel p-5">
            <p className="text-sm font-light">El código actual dejará de funcionar. Vas a ver el nuevo una sola vez.</p>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} className="h-4 w-4 accent-[#b9a388]" />
              Cerrar también todas las sesiones activas
            </label>
            <div className="flex gap-3">
              <Button variant="solid" onClick={generate} disabled={busy}>{busy ? "Generando…" : "Regenerar"}</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
