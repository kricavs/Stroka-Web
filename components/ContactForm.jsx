"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    // No backend in this version: compose an email the user can send.
    const subject = encodeURIComponent(`Consulta — ${form.name || "Web"}`);
    const body = encodeURIComponent(
      `Nombre: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
  };

  const field =
    "w-full border-b hairline bg-transparent py-4 text-bone placeholder:text-ash/60 focus:border-bone focus:outline-none transition-colors duration-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input
        type="text"
        required
        placeholder="Nombre"
        value={form.name}
        onChange={update("name")}
        className={field}
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={form.email}
        onChange={update("email")}
        className={field}
      />
      <textarea
        required
        rows={4}
        placeholder="Contanos sobre tu proyecto"
        value={form.message}
        onChange={update("message")}
        className={`${field} resize-none`}
      />
      <button
        type="submit"
        className="border-b border-bone/40 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
      >
        Enviar mensaje
      </button>
    </form>
  );
}
