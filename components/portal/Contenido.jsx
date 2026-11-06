import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSlot, formatStamp } from "@/lib/shared/time.js";
import { currentApproval, getVisible, listComments } from "@/lib/portal/server/content";
import { isHttpUrl } from "@/lib/shared/content.js";
import { groupFiles } from "@/lib/portal/files-core.js";
import { listForContent } from "@/lib/portal/server/files";
import CommentForm from "./CommentForm";
import { FileGroup } from "./FileList";
import ReviewActions from "./ReviewActions";
import { Eyebrow, StatusPill, Title, card } from "./ui";

export default async function Contenido({ scope, base, id, fileHref }) {
  const item = await getVisible(scope, id);
  if (!item) notFound(); // same 404 for missing / someone else's / not visible
  const canAct = scope.source === "session";
  const hasName = Boolean(scope.displayName);
  const showApproval = ["approved", "scheduled", "published"].includes(item.status);
  const [approval, comments, files] = item.minimal
    ? [null, [], []]
    : await Promise.all([showApproval ? currentApproval(scope, item.id, item.version) : null, listComments(scope, item.id), listForContent(scope, item.id)]);
  const fileGroups = groupFiles(files).flatMap((s) => s.groups);

  return (
    <>
      <Link href={`${base}/calendario`} className="text-[0.68rem] uppercase tracking-wider2 text-[#9a9aa3] hover:text-[#f4f4f2]">← Calendario</Link>
      <div className="mt-6"><Eyebrow>{item.minimal ? "Contenido" : `${item.platformLabel} · ${item.typeLabel}`}</Eyebrow></div>
      <Title>{item.title}</Title>
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-light text-[#c9c9cf]">
        <span>{item.scheduledAt ? formatSlot(new Date(item.scheduledAt)) : "Fecha a definir"}</span>
        <StatusPill status={item.status} label={item.statusLabel} />
        {!item.minimal && <span className="text-xs text-[#9a9aa3]">Versión {item.version}</span>}
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
          {approval && (
            <p className={`${card} p-5 text-sm font-light`}>
              {approval.external ? (
                <>
                  Aprobado por <span className="text-[#f4f4f2]">{approval.by}</span>
                  <span className="block text-xs text-[#9a9aa3]">Registrado por Stroka{approval.channel === "whatsapp" ? " · WhatsApp" : ""} · {formatStamp(new Date(approval.at))}</span>
                </>
              ) : (
                <>
                  Aprobado por <span className="text-[#f4f4f2]">{approval.by}</span>
                  <span className="block text-xs text-[#9a9aa3]">{formatStamp(new Date(approval.at))} · versión {approval.version}</span>
                </>
              )}
            </p>
          )}
          {item.publishedUrl && isHttpUrl(item.publishedUrl) && (
            <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[0.7rem] uppercase tracking-wider2 text-[var(--accent)] hover:text-[#f4f4f2]">
              Ver publicación ↗
            </a>
          )}
          {fileGroups.length > 0 && (
            <section aria-label="Archivos">
              <h2 className="mb-4 text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Archivos</h2>
              <ul className="space-y-3">{fileGroups.map((g) => <FileGroup key={g.key} group={g} fileHref={fileHref} />)}</ul>
            </section>
          )}
          <section className="pt-4" aria-label="Comentarios">
            <h2 className="mb-4 text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Comentarios</h2>
            {comments.length === 0 ? (
              <p className="text-sm font-light text-[#6f6f78]">Todavía no hay comentarios.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className={`${card} p-4`}>
                    <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-[#9a9aa3]">
                      <span className="text-sm text-[#f4f4f2]">{c.authorName}</span>
                      <span>{c.authorType === "studio" ? "Stroka" : "Cliente"}</span>
                      <span>{formatSlot(new Date(c.createdAt))}</span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {canAct && <CommentForm contentId={item.id} hasName={hasName} />}
          </section>
          {canAct && item.canRespond && <div className="h-28 md:hidden" />}
        </div>
      )}
      {canAct && item.canRespond && <ReviewActions contentId={item.id} version={item.version} hasName={hasName} />}
    </>
  );
}
