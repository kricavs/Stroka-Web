"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import NameField from "./NameField";
import { btnSolid, inputCls, portalApi } from "./portalApi";

export default function CommentForm({ contentId, hasName }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await portalApi(`/api/portal/content/${contentId}/comments`, "POST", { body, name: hasName ? undefined : name });
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo enviar.");
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={send} className="mt-5 space-y-3">
      {!hasName && <NameField value={name} onChange={setName} />}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} rows={3} maxLength={2000} placeholder="Escribí un comentario…" required aria-label="Comentario" />
      {error && <p role="alert" className="text-sm text-[#e28a80]">{error}</p>}
      <button type="submit" disabled={busy || !body.trim()} className={btnSolid}>{busy ? "Enviando…" : "Comentar"}</button>
    </form>
  );
}
