import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSlot } from "@/lib/shared/time.js";
import { getVisible } from "@/lib/portal/server/content";
import { isHttpUrl } from "@/lib/shared/content.js";
import { Eyebrow, StatusPill, Title, card } from "./ui";

export default async function Contenido({ scope, base, id }) {
  const item = await getVisible(scope, id);
  if (!item) notFound(); // same 404 for missing / someone else's / not visible

  return (
    <>
      <Link href={`${base}/calendario`} className="text-[0.68rem] uppercase tracking-wider2 text-[#9a9aa3] hover:text-[#f4f4f2]">← Calendario</Link>
      <div className="mt-6"><Eyebrow>{item.minimal ? "Contenido" : `${item.platformLabel} · ${item.typeLabel}`}</Eyebrow></div>
      <Title>{item.title}</Title>
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-light text-[#c9c9cf]">
        <span>{item.scheduledAt ? formatSlot(new Date(item.scheduledAt)) : "Fecha a definir"}</span>
        <StatusPill status={item.status} label={item.statusLabel} />
      </p>

      {item.minimal ? (
        <p className={`${card} mt-8 p-6 text-sm font-light text-[#9a9aa3]`}>
          Estamos trabajando en este contenido. Cuando esté listo vas a poder verlo acá.
        </p>
      ) : (
        <div className="mt-8 space-y-5">
          {item.previewUrl && isHttpUrl(item.previewUrl) && (
            <a href={item.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-block border border-[var(--accent)] px-5 py-3 text-[0.7rem] uppercase tracking-wider2 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#0a0a0b]">
              Ver preview ↗
            </a>
          )}
          {item.copy && (
            <section className={`${card} p-6`}>
              <h2 className="mb-3 text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Texto</h2>
              <p className="whitespace-pre-wrap text-sm font-light leading-relaxed">{item.copy}</p>
            </section>
          )}
          {item.clientNotes && (
            <section className={`${card} p-6`}>
              <h2 className="mb-3 text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Notas</h2>
              <p className="whitespace-pre-wrap text-sm font-light leading-relaxed">{item.clientNotes}</p>
            </section>
          )}
          {item.publishedUrl && isHttpUrl(item.publishedUrl) && (
            <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[0.7rem] uppercase tracking-wider2 text-[var(--accent)] hover:text-[#f4f4f2]">
              Ver publicación ↗
            </a>
          )}
        </div>
      )}
    </>
  );
}
