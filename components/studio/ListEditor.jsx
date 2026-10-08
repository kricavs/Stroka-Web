"use client";

import { Button, Input } from "./ui";

// Editable list of one-line strings (features, deliverables).
export default function ListEditor({ values, onChange, placeholder, addLabel = "Agregar línea" }) {
  const set = (i, v) => onChange(values.map((x, k) => (k === i ? v : x)));
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <Button variant="ghost" aria-label="Quitar" onClick={() => onChange(values.filter((_, k) => k !== i))}>×</Button>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...values, ""])}>+ {addLabel}</Button>
    </div>
  );
}
