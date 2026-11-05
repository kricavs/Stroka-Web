"use client";

import { inputCls } from "./portalApi";

// Shown only while the session has no declared name. The name is declared by
// whoever uses the company code — it labels the history, it is not verified.
export default function NameField({ value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.62rem] font-medium uppercase tracking-wider2 text-[#9a9aa3]">Tu nombre</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        placeholder="María Gómez"
        autoComplete="name"
        maxLength={80}
        required
      />
      <span className="mt-1 block text-xs text-[#6f6f78]">Lo usamos para registrar quién respondió.</span>
    </label>
  );
}
