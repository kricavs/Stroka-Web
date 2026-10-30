"use client";

import { useEffect, useState } from "react";
import { LIMITS, validateReference } from "@/lib/testimonials-shared";

const EMPTY = { brand: "", person: "", comment: "" };

export default function ReferenceForm() {
  const [form, setForm] = useState(EMPTY);
  const [website, setWebsite] = useState(""); // honeypot
  const [openedAt, setOpenedAt] = useState(0);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  useEffect(() => setOpenedAt(Date.now()), []);
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const v = validateReference(form);
    setErrors(v.errors);
    if (!v.ok) return;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v.value, website, t: openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setForm(EMPTY);
        setErrors({});
        setOpenedAt(Date.now());
        setState("sent");
        return;
      }
      if (data.errors) setErrors(data.errors);
      setMessage(data.error || "No pudimos enviar tu comentario. Revisá los campos.");
    } catch {
      setMessage("No pudimos enviar tu comentario. Revisá tu conexión.");
    }
    setState("error");
  }

  const field =
    "w-full border-b hairline bg-transparent py-4 text-bone placeholder:text-ash/60 focus:border-bone focus:outline-none transition-colors duration-300";
  const err = (k) => (errors[k] ? <p role="alert" className="mt-2 text-xs text-red-400">{errors[k]}</p> : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {state === "sent" && (
        <p role="status" className="border-l border-bone/60 pl-4 text-sm leading-relaxed text-bone">
          Gracias. Tu comentario fue enviado para revisión. Se publicará únicamente una vez aprobado.
        </p>
      )}
      <div>
        <input type="text" placeholder="Nombre de la marca" maxLength={LIMITS.brand} value={form.brand} onChange={update("brand")} className={field} aria-label="Nombre de la marca" autoComplete="organization" />
        {err("brand")}
      </div>
      <div>
        <input type="text" placeholder="Nombre del responsable" maxLength={LIMITS.person} value={form.person} onChange={update("person")} className={field} aria-label="Nombre del responsable" autoComplete="name" />
        {err("person")}
      </div>
      <div>
        <textarea rows={6} placeholder="Comentario" maxLength={LIMITS.commentMax} value={form.comment} onChange={update("comment")} className={`${field} resize-none`} aria-label="Comentario" />
        <div className="mt-2 flex justify-between text-xs text-ash/70">
          <span>{err("comment") || null}</span>
          <span>{form.comment.length} / {LIMITS.commentMax}</span>
        </div>
      </div>
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sitio web
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {state === "error" && message && <p role="alert" className="text-sm text-red-400">{message}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="border-b border-bone/50 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone disabled:opacity-50"
      >
        {state === "sending" ? "Enviando…" : "Enviar →"}
      </button>
    </form>
  );
}
