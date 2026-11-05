"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import NameField from "./NameField";
import { btnLine, btnSolid, inputCls, portalApi } from "./portalApi";

// Approve / request changes for content in "client_review". `version` is the
// version on screen: if Studio changed it meanwhile the server answers 409.
export default function ReviewActions({ contentId, version, hasName }) {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | "approve" | "changes"
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const path = mode === "approve" ? "approve" : "request-changes";
    const payload = { version, name: hasName ? undefined : name, ...(mode === "changes" ? { body } : {}) };
    const r = await portalApi(`/api/portal/content/${contentId}/${path}`, "POST", payload);
    setBusy(false);
    if (r.ok || r.status === 409) {
      if (!r.ok) setError(r.data.error || "");
      router.refresh();
      return;
    }
    setError(r.data.error || "No se pudo enviar.");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#2a2a31] bg-[#16161a]/95 p-4 backdrop-blur md:static md:mt-8 md:border md:bg-[#1d1d22] md:p-6">
      {!mode ? (
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row">
          <button className={`${btnSolid} flex-1`} onClick={() => setMode("approve")}>Aprobar</button>
          <button className={`${btnLine} flex-1`} onClick={() => setMode("changes")}>Pedir cambios</button>
        </div>
      ) : (
        <form onSubmit={send} className="mx-auto max-h-[75vh] max-w-5xl space-y-4 overflow-y-auto">
          <p className="text-sm font-light">
            {mode === "approve" ? "Vas a aprobar esta versión." : "Contanos qué ajustarías y lo revisamos."}
          </p>
          {!hasName && <NameField value={name} onChange={setName} />}
          {mode === "changes" && (
            <label className="block">
              <span className="mb-2 block text-[0.62rem] font-medium uppercase tracking-wider2 text-[#9a9aa3]">¿Qué cambiarías?</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} rows={4} maxLength={2000} required autoFocus />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-[#e28a80]">{error}</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={busy} className={`${btnSolid} flex-1`}>
              {busy ? "Enviando…" : mode === "approve" ? "Confirmar aprobación" : "Enviar pedido de cambios"}
            </button>
            <button type="button" className={`${btnLine} sm:w-40`} onClick={() => { setMode(null); setError(""); }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
