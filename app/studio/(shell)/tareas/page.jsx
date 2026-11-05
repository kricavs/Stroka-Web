import Link from "next/link";
import PageHead from "@/components/studio/PageHead";
import TaskTable from "@/components/studio/TaskTable";
import { Button, Select } from "@/components/studio/ui";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { listTasks } from "@/lib/studio/server/tasks";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_VISIBILITIES } from "@/lib/shared/content.js";
import { ymd } from "@/lib/shared/time.js";

const pick = (v, list) => (list.some(([k]) => k === v) ? v : "");

export default async function TasksPage({ searchParams }) {
  await requireSession();
  const today = ymd(new Date());
  const f = {
    client: typeof searchParams.client === "string" ? searchParams.client.slice(0, 64) : "",
    status: searchParams.status === "open" ? "open" : pick(searchParams.status, TASK_STATUSES),
    priority: pick(searchParams.priority, TASK_PRIORITIES),
    visibility: pick(searchParams.visibility, TASK_VISIBILITIES),
    when: ["overdue", "today"].includes(searchParams.when) ? searchParams.when : "",
  };
  // Default view: open tasks.
  const status = searchParams.status === undefined ? "open" : f.status;
  const [clients, tasks] = await Promise.all([
    clientOptions(),
    listTasks({ clientId: f.client, status, priority: f.priority, visibility: f.visibility, overdue: f.when === "overdue", dueToday: f.when === "today", today }),
  ]);
  return (
    <>
      <PageHead eyebrow="Operación" title="Tareas">
        <Link href="/studio/tareas/nueva" className="bg-champagne px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-ink hover:bg-bone">Nueva tarea</Link>
      </PageHead>
      <form method="get" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Select name="client" defaultValue={f.client} aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status} aria-label="Estado">
          <option value="open">Abiertas</option><option value="">Todas</option>
          {TASK_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select name="priority" defaultValue={f.priority} aria-label="Prioridad">
          <option value="">Toda prioridad</option>{TASK_PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select name="visibility" defaultValue={f.visibility} aria-label="Visibilidad">
          <option value="">Toda visibilidad</option>{TASK_VISIBILITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select name="when" defaultValue={f.when} aria-label="Vencimiento">
          <option value="">Cualquier fecha</option><option value="overdue">Vencidas</option><option value="today">Para hoy</option>
        </Select>
        <Button type="submit" variant="line">Filtrar</Button>
      </form>
      <TaskTable tasks={tasks} today={today} />
    </>
  );
}
