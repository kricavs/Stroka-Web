import { formatBytes } from "@/lib/files/rules.js";
import { formatDayShort } from "@/lib/shared/time.js";
import { card } from "./ui";

const KIND = { image: "Imagen", pdf: "PDF", archive: "ZIP" };
const dayOf = (iso) => formatDayShort(new Date(iso));

function Item({ f, fileHref, older }) {
  const viewable = f.kind === "image" || f.kind === "pdf";
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${older ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
          <span className="min-w-0 break-words">{f.name}</span>
          {f.isFinal && <span className="bg-[var(--accent)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider2 text-[#0a0a0b]">Final</span>}
          <span className="text-xs text-[#9a9aa3]">Versión {f.version}</span>
        </p>
        {f.description && <p className="mt-1 text-sm font-light text-[#c9c9cf]">{f.description}</p>}
        <p className="mt-1 text-xs font-light text-[#9a9aa3]">{dayOf(f.createdAt)} · {KIND[f.kind] || "Archivo"} · {formatBytes(f.size)}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {viewable && (
          <a href={`${fileHref(f.id)}?inline=1`} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center border border-[#55524d] px-5 text-[0.7rem] uppercase tracking-wider2 hover:border-[var(--accent)] hover:text-[var(--accent)]">Ver</a>
        )}
        <a href={fileHref(f.id)} className="flex min-h-[44px] flex-1 items-center justify-center bg-[var(--accent)] px-6 text-[0.72rem] font-semibold uppercase tracking-wider2 text-[#0a0a0b] hover:bg-[#f4f4f2] sm:flex-none">Descargar</a>
      </div>
    </div>
  );
}

// groups: from groupFiles(); the newest version leads, earlier ones are tucked away.
export function FileGroup({ group, fileHref }) {
  return (
    <li className={`${card} p-5`}>
      <Item f={group.latest} fileHref={fileHref} />
      {group.older.length > 0 && (
        <details className="mt-4 border-t border-[#2a2a31] pt-3">
          <summary className="min-h-[44px] cursor-pointer py-2 text-xs uppercase tracking-wider2 text-[#9a9aa3]">Versiones anteriores ({group.older.length})</summary>
          <div className="mt-3 space-y-5">
            {group.older.map((o) => <Item key={o.id} f={o} fileHref={fileHref} older />)}
          </div>
        </details>
      )}
    </li>
  );
}
