import Link from "next/link";
import PageHead from "@/components/studio/PageHead";
import { requireSession } from "@/lib/studio/server/auth";
import { listClients } from "@/lib/studio/server/clients";
import { dashboardData } from "@/lib/studio/server/content";
import { listTasks, taskCounts } from "@/lib/studio/server/tasks";
import { PLATFORM_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/shared/content.js";
import { addDays, dayRange, formatDayShort, formatSlot, monthKey, monthRange, ymd, zonedParts } from "@/lib/shared/time.js";

const hhmm = (iso) => {
  const p = zonedParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

function Block({ title, count, children, empty }) {
  return (
    <section className="border border-edge bg-panel p-5">
      <h2 className="mb-4 flex items-baseline justify-between text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">
        {title}
        {count !== undefined && <span className="font-title text-2xl tracking-normal text-bone">{count}</span>}
      </h2>
      {children}
      {empty}
    </section>
  );
}

function Row({ it, withDate }) {
  return (
    <li>
      <Link href={`/studio/contenido/${it.id}`} className="flex items-center gap-3 py-2 text-sm font-light hover:text-champagne">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
        <span className="w-24 shrink-0 text-xs text-ash">{it.scheduledAt ? (withDate ? formatSlot(new Date(it.scheduledAt)) : hhmm(it.scheduledAt)) : "Sin fecha"}</span>
        <span className="min-w-0 flex-1 truncate">{it.clientName} · {it.title}</span>
        <span className="hidden text-xs text-ash sm:inline">{PLATFORM_LABEL[it.platform]}</span>
      </Link>
    </li>
  );
}

function TaskRow({ t }) {
  return (
    <li>
      <Link href={`/studio/tareas/${t.id}`} className="flex items-center gap-3 py-2 text-sm font-light hover:text-champagne">
        <span className="min-w-0 flex-1 truncate">{t.client_name ? `${t.client_name} · ` : ""}{t.title}</span>
        <span className="shrink-0 text-xs text-ash">{t.due ? formatDayShort(new Date(`${t.due}T15:00:00Z`)) : ""}</span>
      </Link>
    </li>
  );
}

export default async function StudioHome() {
  await requireSession();
  const now = new Date();
  const today = ymd(now);
  const month = monthKey(now);
  const mr = monthRange(month);
  const [data, clients, counts, lateTasks, todayTasks] = await Promise.all([
    dashboardData({
      today: dayRange(today),
      upcoming: { start: dayRange(addDays(today, 1)).start, end: dayRange(addDays(today, 8)).start },
    }),
    listClients({ month, monthStart: mr.start, monthEnd: mr.end, now }),
    taskCounts(today),
    listTasks({ overdue: true, today, limit: 8 }),
    listTasks({ dueToday: true, today, limit: 8 }),
  ]);
  const active = clients.filter((c) => c.active);
  const none = (t) => <p className="text-sm font-light text-ash">{t}</p>;

  return (
    <>
      <PageHead eyebrow={formatDayShort(now)} title="Hoy">
        <Link href="/studio/contenido/nuevo" className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Nuevo contenido</Link>
      </PageHead>

      <div className="grid gap-5 lg:grid-cols-2">
        <Block title="Publicaciones de hoy" count={data.todayItems.length} empty={data.todayItems.length ? null : none("Nada programado para hoy.")}>
          <ul className="divide-y divide-edge">{data.todayItems.map((it) => <Row key={it.id} it={it} />)}</ul>
        </Block>
        <Block title="Esperando aprobación" count={data.review.length} empty={data.review.length ? null : none("Nada esperando al cliente.")}>
          <ul className="divide-y divide-edge">{data.review.map((it) => <Row key={it.id} it={it} withDate />)}</ul>
        </Block>
        <Block title="Cambios solicitados" count={data.changes.length} empty={data.changes.length ? null : none("Ningún cliente pidió cambios.")}>
          <ul className="divide-y divide-edge">{data.changes.map((it) => <Row key={it.id} it={it} withDate />)}</ul>
        </Block>
        <Block title="Tareas vencidas" count={counts.overdue} empty={lateTasks.length ? null : none("Sin tareas vencidas.")}>
          <ul className="divide-y divide-edge">{lateTasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
        </Block>
        <Block title="Tareas para hoy" count={counts.due_today} empty={todayTasks.length ? null : none("Nada con vencimiento hoy.")}>
          <ul className="divide-y divide-edge">{todayTasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
        </Block>
        <Block title="Próximos 7 días" count={data.upcomingItems.length} empty={data.upcomingItems.length ? null : none("Sin publicaciones próximas.")}>
          <ul className="divide-y divide-edge">{data.upcomingItems.map((it) => <Row key={it.id} it={it} withDate />)}</ul>
        </Block>
        <Block title="Clientes" count={active.length} empty={active.length ? null : none("Todavía no hay clientes activos.")}>
          <ul className="divide-y divide-edge">
            {active.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/clientes/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm font-light hover:text-champagne">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-xs text-ash">
                    {c.month_published}/{c.contracted || "—"} publicados{c.pending > 0 ? ` · ${c.pending} en revisión` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      </div>
    </>
  );
}
