import PageHead from "@/components/studio/PageHead";
import TaskForm from "@/components/studio/TaskForm";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { getContent } from "@/lib/studio/server/content";

export default async function NewTaskPage({ searchParams }) {
  await requireSession();
  const clients = (await clientOptions()).filter((c) => c.active);
  const content = typeof searchParams.content === "string" ? await getContent(searchParams.content) : null;
  return (
    <>
      <PageHead eyebrow="Tareas" title="Nueva tarea" />
      <TaskForm
        clients={clients}
        initial={{
          title: "", description: "", assignee: "", dueDate: "", priority: "normal", visibility: "internal",
          clientId: content?.clientId || (typeof searchParams.client === "string" ? searchParams.client : ""),
          contentId: content?.id || "", contentTitle: content?.title || "",
        }}
      />
    </>
  );
}
