import Link from "next/link";
import { formatDayShort, formatSlot } from "@/lib/shared/time.js";
import { listPending } from "@/lib/portal/server/content";
import TaskComplete from "./TaskComplete";
import { Eyebrow, StatusPill, Title, card } from "./ui";

const dayLabel = (ymdStr) => formatDayShort(new Date(`${ymdStr}T15:00:00Z`));

export default async function Pendientes({ scope, base }) {
  const items = await listPending(scope);
  const canAct = scope.source === "session";
  const hasName = Boolean(scope.displayName);

  return (
    <>
      <Eyebrow>Pendientes</Eyebrow>
      <Title>Para vos</Title>
      {items.length === 0 ? (
        <p className={`${card} mt-8 p-6 text-sm font-light text-[#9a9aa3]`}>No tenés nada pendiente. ¡Todo al día!</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((it) =>
            it.kind === "task" ? (
              <li key={it.task.id} className={`${card} p-5`}>
                <p className="text-[0.62rem] uppercase tracking-wider2 text-[var(--accent)]">Tarea</p>
                <p className="mt-2 text-base">{it.task.title}</p>
                {it.task.description && <p className="mt-2 whitespace-pre-wrap text-sm font-light text-[#c9c9cf]">{it.task.description}</p>}
                <p className="mt-3 flex flex-wrap gap-x-4 text-xs font-light text-[#9a9aa3]">
                  {it.task.dueDate && <span className={it.task.overdue ? "text-[#e28a80]" : ""}>{it.task.overdue ? "Venció" : "Vence"} {dayLabel(it.task.dueDate)}</span>}
                  {it.task.contentId && <Link href={`${base}/contenido/${it.task.contentId}`} className="text-[var(--accent)] hover:underline">{it.task.contentTitle}</Link>}
                </p>
                {canAct && <TaskComplete taskId={it.task.id} hasName={hasName} />}
              </li>
            ) : (
              <li key={it.content.id}>
                <Link href={`${base}/contenido/${it.content.id}`} className={`${card} block p-5 hover:border-[var(--accent)]`}>
                  <p className="text-[0.62rem] uppercase tracking-wider2 text-[var(--accent)]">
                    Para tu revisión
                  </p>
                  <p className="mt-2 text-base">{it.content.title}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-light text-[#9a9aa3]">
                    <span>{it.content.scheduledAt ? formatSlot(new Date(it.content.scheduledAt)) : "Fecha a definir"}</span>
                    <span>{it.content.platformLabel} · {it.content.typeLabel}</span>
                    <StatusPill status={it.content.status} label={it.content.statusLabel} />
                    {it.overdue && <span className="text-[#e28a80]">Fecha vencida</span>}
                  </p>
                </Link>
              </li>
            )
          )}
        </ul>
      )}
    </>
  );
}
