import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/studio/PageHead";
import TaskForm from "@/components/studio/TaskForm";
import TaskStatusButtons from "@/components/studio/TaskStatusButtons";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { getTask } from "@/lib/studio/server/tasks";
import { TASK_STATUS_LABEL } from "@/lib/shared/content.js";
import { formatStamp } from "@/lib/shared/time.js";

export default async function TaskPage({ params }) {
  await requireSession();
  const t = await getTask(params.id);
  if (!t) notFound();
  const clients = (await clientOptions()).filter((c) => c.active || c.id === t.client_id);
  return (
    <>
      <PageHead eyebrow={t.client_name || "Tarea"} title="Tarea">
        <Link href="/studio/tareas" className="text-[0.68rem] uppercase tracking-wider2 text-ash hover:text-champagne">← Tareas</Link>
      </PageHead>
      <div className="mb-8 space-y-3 text-sm">
        <p className="uppercase tracking-wider2">{TASK_STATUS_LABEL[t.status]}{t.completed_at ? ` · ${t.completed_by} · ${formatStamp(new Date(t.completed_at))}` : ""}</p>
        <TaskStatusButtons id={t.id} status={t.status} />
      </div>
      <TaskForm
        key={`${t.id}-${t.updated_at}`}
        id={t.id}
        clients={clients}
        initial={{
          title: t.title, description: t.description || "", assignee: t.assignee || "", dueDate: t.due || "",
          priority: t.priority, visibility: t.visibility, clientId: t.client_id || "",
          contentId: t.content_id || "", contentTitle: t.content_title || "",
        }}
      />
    </>
  );
}
