"use client";

import { useState } from "react";
import { Field, Input, Button } from "./ui";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/studio/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: f.get("user"), password: f.get("password") }),
    });
    if (res.ok) {
      window.location.href = "/studio/presupuestos";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "No se pudo iniciar sesión");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-5">
      <Field label="Usuario">
        <Input name="user" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="solid" disabled={busy}>{busy ? "Verificando…" : "Entrar"}</Button>
    </form>
  );
}
