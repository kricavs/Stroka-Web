import Link from "next/link";
import { notFound } from "next/navigation";
import ContentForm from "@/components/studio/ContentForm";
import PageHead from "@/components/studio/PageHead";
import StatusActions from "@/components/studio/StatusActions";
import { requireSession } from "@/lib/studio/server/auth";
import CommentThread from "@/components/studio/CommentThread";
import ExternalApproval from "@/components/studio/ExternalApproval";
import { contentApprovals, contentHistory, getContent, listStudioComments } from "@/lib/studio/server/content";
import { EVENT_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/shared/content.js";
import { formatStamp, toLocalInput } from "@/lib/shared/time.js";

export default async function ContentPage({ params }) {
  await requireSession();
  const item = await getContent(params.id);
  if (!item) notFound();
  const [comments, approvals, history] = await Promise.all([listStudioComments(item.id), contentApprovals(item.id), contentHistory(item.id)]);
  const current = approvals.filter((a) => a.content_version === item.version && a.action !== "changes_requested").at(-1);
  return (
    <>
      <PageHead eyebrow={item.clientName} title="Contenido">
        <Link href={`/studio/clientes/${item.clientId}?tab=contenidos`} className="text-[0.68rem] uppercase tracking-wider2 text-ash hover:text-champagne">← {item.clientName}</Link>
      </PageHead>
      <div className="mb-8 max-w-3xl space-y-3">
        <p className="flex items-center gap-3 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[item.status] }} />
          <span className="uppercase tracking-wider2">{STATUS_LABEL[item.status]}</span>
          <span className="text-xs text-ash">v{item.version}</span>
        </p>
        <StatusActions id={item.id} status={item.status} />
        {item.status === "client_review" && <ExternalApproval contentId={item.id} />}
        {current && ["approved", "scheduled", "published"].includes(item.status) && (
          <p className="text-sm font-light text-ash">
            {current.action === "manual_approval" ? (
              <>Aprobado externamente por <span className="text-bone">{current.metadata?.approverName}</span> · Registrado por Stroka · {current.metadata?.channel === "whatsapp" ? "WhatsApp" : current.metadata?.channel}</>
            ) : (
              <>Aprobado por <span className="text-bone">{current.actor_name}</span> desde el portal</>
            )}{" "}· v{current.content_version} · {formatStamp(new Date(current.created_at))}
          </p>
        )}
        <Link href={`/studio/tareas/nueva?content=${item.id}`} className="inline-block text-[0.68rem] uppercase tracking-wider2 text-ash hover:text-champagne">+ Crear tarea para este contenido</Link>
      </div>
      <ContentForm
        key={`${item.id}-${item.version}-${item.status}`}
        id={item.id}
        clients={[]}
        initial={{ ...item, scheduledLocal: item.scheduledAt ? toLocalInput(new Date(item.scheduledAt)) : "" }}
      />
      <section className="mt-14">
        <h2 className="mb-5 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Comentarios</h2>
        <CommentThread contentId={item.id} comments={comments} />
      </section>
      <section className="mt-14 max-w-3xl">
        <h2 className="mb-5 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Historial</h2>
        <ul className="divide-y divide-edge border border-edge">
          {history.map((h) => (
            <li key={h.seq} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 p-3 text-sm font-light">
              <span className="w-36 shrink-0 text-xs text-ash">{formatStamp(new Date(h.created_at))}</span>
              <span>{EVENT_LABEL[h.event] || h.event}</span>
              <span className="text-xs text-ash">
                {h.event === "content.status_changed" && `${STATUS_LABEL[h.data.from] || h.data.from} → ${STATUS_LABEL[h.data.to] || h.data.to}${h.data.newVersion ? ` · nueva versión v${h.data.newVersion}` : ""}`}
                {h.event === "content.sent_for_review" && `v${h.data.version}`}
                {["content.approved", "content.changes_requested"].includes(h.event) && `v${h.data.version}`}
                {h.event === "content.manual_approval" && `${h.data.approverName} · ${h.data.channel} · v${h.data.version}`}
                {h.event === "content.approval_invalidated" && `v${h.data.fromVersion} → v${h.data.toVersion} (${(h.data.fields || []).join(", ")})`}
              </span>
              <span className="ml-auto text-xs text-ash">{h.actor_name}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
