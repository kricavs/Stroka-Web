import Link from "next/link";
import CalendarView from "@/components/studio/CalendarView";
import PageHead from "@/components/studio/PageHead";
import { Button, Select } from "@/components/studio/ui";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { listContent } from "@/lib/studio/server/content";
import { calendarTasks } from "@/lib/studio/server/operations";
import { getContentRisk } from "@/lib/operations/rules.js";
import { TASK_PRIORITIES } from "@/lib/shared/content.js";
import { viewDays, viewRange } from "@/lib/shared/calendar.js";
import { calendarHref, parseCalendarParams } from "@/lib/studio/calendar-params.js";
import { CONTENT_TYPES, PLATFORMS, STATUSES, STATUS_LABEL } from "@/lib/shared/content.js";

export default async function CalendarPage({ searchParams }) {
  await requireSession();
  const st = parseCalendarParams(searchParams);
  const f = { clientId: st.client, platform: st.platform, status: st.status, type: st.type };
  const showContent = st.content !== "0";
  const showTasks = st.tasks !== "0";
  const now = new Date();
  const range = viewRange(st.view, st.date);
  const days = viewDays(st.view, st.date);
  const [clients, rawItems, rawUndated, tasks, undatedTasks] = await Promise.all([
    clientOptions(),
    showContent ? listContent({ ...f, range }) : [],
    showContent ? listContent({ ...f, undated: true }) : [],
    showTasks ? calendarTasks({ clientId: st.client, priority: st.prio, fromDay: days.first, toDay: days.last }) : [],
    showTasks ? calendarTasks({ clientId: st.client, priority: st.prio, undated: true }) : [],
  ]);
  const items = rawItems.map((it) => ({ ...it, risk: getContentRisk(it, now) }));
  const undated = rawUndated;
  const base = "/studio/calendario";
  const newHref = (day) => `/studio/contenido/nuevo?date=${day}${st.client ? `&client=${st.client}` : ""}`;

  return (
    <>
      <PageHead eyebrow="Operación" title="Calendario">
        <Link href={newHref("")} className="bg-champagne px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-ink hover:bg-bone">Nuevo contenido</Link>
      </PageHead>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-[0.68rem] uppercase tracking-wider2">
        <div className="flex gap-4">
          {[["month", "Mes"], ["week", "Semana"], ["agenda", "Agenda"]].map(([v, l]) => (
            <Link key={v} href={calendarHref(base, st, { view: v })} className={st.view === v ? "text-champagne" : "text-ash hover:text-bone"}>{l}</Link>
          ))}
        </div>
        {/* Layers: both on by default. */}
        <div className="flex gap-4" role="group" aria-label="Capas">
          {[["content", "Contenido", showContent], ["tasks", "Tareas", showTasks]].map(([k, l, on]) => (
            <Link key={k} href={calendarHref(base, st, { [k]: on ? "0" : "" })} aria-pressed={on} className={on ? "text-champagne" : "text-ash line-through hover:text-bone"}>{l}</Link>
          ))}
        </div>
      </div>

      <form method="get" action={base} className={`mb-8 grid gap-3 sm:grid-cols-2 ${showTasks ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        <input type="hidden" name="view" value={st.view} />
        <input type="hidden" name="date" value={st.date} />
        {st.content === "0" && <input type="hidden" name="content" value="0" />}
        {st.tasks === "0" && <input type="hidden" name="tasks" value="0" />}
        <Select name="client" defaultValue={st.client} aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inactivo)"}</option>)}
        </Select>
        <Select name="platform" defaultValue={st.platform} aria-label="Plataforma">
          <option value="">Todas las plataformas</option>
          {PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select name="status" defaultValue={st.status} aria-label="Estado">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <Select name="type" defaultValue={st.type} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {CONTENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        {showTasks && (
          <Select name="prio" defaultValue={st.prio} aria-label="Prioridad de tarea">
            <option value="">Toda prioridad (tareas)</option>
            {TASK_PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        )}
        <Button type="submit" variant="line">Filtrar</Button>
      </form>

      <CalendarView
        view={st.view}
        anchor={st.date}
        items={items}
        undated={undated}
        href={(p) => calendarHref(base, st, p)}
        newHref={newHref}
        showClient={!st.client}
        tasks={tasks}
        undatedTasks={showTasks ? undatedTasks : null}
      />
    </>
  );
}
