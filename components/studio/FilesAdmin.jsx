"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";
import { api } from "./api";
import FileUploader from "./FileUploader";
import { CATEGORY_LABEL, formatBytes, uploaderKey } from "@/lib/files/rules.js";
import { formatDayShort } from "@/lib/shared/time.js";

const KIND = { image: "Imagen", pdf: "PDF", archive: "ZIP" };
const kindOf = (mime) => (mime.startsWith("image/") ? "image" : mime === "application/pdf" ? "pdf" : "archive");

function Row({ f, newest, onVersion }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(fn) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }
  const open = (inline) => `/api/studio/files/${f.id}${inline ? "?inline=1" : ""}`;
  const viewable = f.mime.startsWith("image/") || f.mime === "application/pdf";
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm font-light ${newest ? "" : "pl-8 opacity-70"}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {f.name}
          {f.is_final && <span className="ml-2 bg-champagne px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider2 text-ink">Final</span>}
          {!f.client_visible && <span className="ml-2 text-[0.58rem] uppercase tracking-wider2 text-[#e0a35f]">Oculto</span>}
        </span>
        <span className="block text-xs text-ash">
          {CATEGORY_LABEL[f.category]} · {KIND[kindOf(f.mime)]} · {formatBytes(Number(f.size))} · v{f.version} · {formatDayShort(new Date(f.created_at))}
          {f.content_title ? ` · ${f.content_title}` : ""}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {viewable && <a href={open(true)} target="_blank" rel="noopener noreferrer" className="border border-[#55524d] px-3 py-1.5 text-[0.66rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Ver</a>}
        <a href={open(false)} className="border border-[#55524d] px-3 py-1.5 text-[0.66rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Descargar</a>
        {newest && <Button variant="ghost" className="!px-3 !py-1.5" onClick={() => onVersion(f)}>Nueva versión</Button>}
        <Button variant="ghost" className="!px-3 !py-1.5" disabled={busy} onClick={() => act(() => api(`/api/studio/files/${f.id}`, "PATCH", { final: !f.is_final }))}>{f.is_final ? "Quitar final" : "Marcar final"}</Button>
        <Button variant="ghost" className="!px-3 !py-1.5" disabled={busy} onClick={() => act(() => api(`/api/studio/files/${f.id}`, "PATCH", { visible: !f.client_visible }))}>{f.client_visible ? "Ocultar" : "Mostrar"}</Button>
        <Button variant="danger" className="!px-3 !py-1.5" disabled={busy} onClick={() => window.confirm("¿Archivar este archivo? Deja de verse en el portal; los datos se conservan.") && act(() => api(`/api/studio/files/${f.id}`, "DELETE"))}>Archivar</Button>
      </span>
    </li>
  );
}

// files: rows from listClientFiles (JSON-safe); contents: [{id,title}]
export default function FilesAdmin({ clientId, files, contents, enabled }) {
  const [versionOf, setVersionOf] = useState(null);
  const groups = new Map();
  for (const f of files) {
    if (!groups.has(f.group_key)) groups.set(f.group_key, []);
    groups.get(f.group_key).push(f);
  }
  const ordered = [...groups.values()].map((l) => l.sort((a, b) => b.version - a.version));

  if (!enabled) {
    return <p className="max-w-xl border border-edge bg-panel p-4 text-sm font-light text-ash">Los archivos no están disponibles: falta configurar el store privado (CLIENT_FILES_READ_WRITE_TOKEN).</p>;
  }
  return (
    <div className="space-y-6">
      {/* The key remounts the uploader per target: its `open` state is only read on mount,
          so without it "Nueva versión" reused the closed "Subir archivo" instance and did nothing visible. */}
      <FileUploader
        key={uploaderKey(versionOf)}
        clientId={clientId}
        contents={contents}
        base={versionOf ? { id: versionOf.id, name: versionOf.name, category: versionOf.category, contentId: versionOf.content_id } : undefined}
        onDone={() => setVersionOf(null)}
      />
      {ordered.length === 0 ? (
        <p className="text-sm font-light text-ash">Este cliente todavía no tiene archivos.</p>
      ) : (
        <ul className="divide-y divide-edge border border-edge">
          {ordered.map((list) => (
            <li key={list[0].group_key}>
              <ul className="divide-y divide-edge/60">
                {list.map((f, i) => <Row key={f.id} f={f} newest={i === 0} onVersion={setVersionOf} />)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
