"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Textarea } from "./ui";
import { api } from "./api";
import { formatSlot } from "@/lib/shared/time.js";

// Plain-text comments, no editing (add a new one to correct something).
export default function CommentThread({ contentId, comments }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await api(`/api/studio/content/${contentId}/comments`, "POST", { body });
    setBusy(false);
    if (!r.ok) return setError(r.data.error || "No se pudo enviar.");
    setBody("");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      {comments.length === 0 ? (
        <p className="text-sm font-light text-ash">Sin comentarios.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border border-edge bg-panel p-4">
              <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-ash">
                <span className="text-sm text-bone">{c.authorName}</span>
                <span>{c.authorType === "studio" ? "Studio" : "Cliente"}</span>
                <span>{formatSlot(new Date(c.createdAt))}</span>
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-light">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="mt-4 space-y-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Comentar como Stroka… (el cliente lo ve si el contenido es visible para él)" aria-label="Comentario" />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" variant="line" disabled={busy || !body.trim()}>{busy ? "Enviando…" : "Comentar"}</Button>
      </form>
    </div>
  );
}
