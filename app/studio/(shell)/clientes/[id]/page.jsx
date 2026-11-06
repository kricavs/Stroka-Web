import Link from "next/link";
import { notFound } from "next/navigation";
import AccessPanel from "@/components/studio/AccessPanel";
import CalendarView from "@/components/studio/CalendarView";
import ClientForm from "@/components/studio/ClientForm";
import GoalForm from "@/components/studio/GoalForm";
import PageHead from "@/components/studio/PageHead";
import FilesAdmin from "@/components/studio/FilesAdmin";
import TaskTable from "@/components/studio/TaskTable";
import { filesMode } from "@/lib/files/server/storage";
import { listClientFiles } from "@/lib/studio/server/files";
import { listTasks } from "@/lib/studio/server/tasks";
import { requireSession } from "@/lib/studio/server/auth";
import { getClient, listActivity } from "@/lib/studio/server/clients";
import ClientOpsHeader from "@/components/studio/ops/ClientOpsHeader";
import { listContent } from "@/lib/studio/server/content";
import { getOperations } from "@/lib/studio/server/operations";
import { getDb } from "@/lib/studio/server/db";
import { viewRange } from "@/lib/shared/calendar.js";
import { calendarHref, parseCalendarParams } from "@/lib/studio/calendar-params.js";
import { EVENT_LABEL, PLATFORM_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/shared/content.js";
import { formatSlot, formatStamp, monthKey, ymd } from "@/lib/shared/time.js";

const TABS = [
  ["resumen", "Resumen"],
  ["calendario", "Calendario"],
  ["contenidos", "Contenidos"],
  ["tareas", "Tareas"],
  ["archivos", "Archivos"],
  ["actividad", "Actividad"],
  ["acceso", "Acceso"],
];

export default async function ClientPage({ params, searchParams }) {
  await requireSession();
  const client = await getClient(params.id);
  if (!client) notFound();
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab : "resumen";
  const base = `/studio/clientes/${client.id}`;

  return (
    <>
      <PageHead eyebrow="Cliente" title={client.name}>
        {!client.active && <span className="border border-edge px-3 py-2 text-[0.64rem] uppercase tracking-wider2 text-ash">Inactivo</span>}
        <Link href={`/studio/ver/${client.id}`} className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Ver como cliente</Link>
        <Link href={`/studio/contenido/nuevo?client=${client.id}`} className="bg-champagne px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-ink hover:bg-bone">Nuevo contenido</Link>
      </PageHead>

      <nav className="-mt-2 mb-8 flex gap-1 overflow-x-auto border-b border-edge text-[0.68rem] uppercase tracking-wider2">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`${base}?tab=${k}`} className={`whitespace-nowrap border-b-2 px-4 py-3 ${tab === k ? "border-champagne text-champagne" : "border-transparent text-ash hover:text-bone"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "resumen" && <ResumenTab client={client} />}
      {tab === "calendario" && <CalendarioTab client={client} base={base} searchParams={searchParams} />}
      {tab === "contenidos" && <ContenidosTab client={client} />}
      {tab === "tareas" && <TareasTab client={client} />}
      {tab === "archivos" && <ArchivosTab client={client} />}
      {tab === "acceso" && <AccessPanel client={JSON.parse(JSON.stringify(client))} justCreated={searchParams.nuevo === "1"} />}
      {tab === "actividad" && <ActividadTab client={client} />}
    </>
  );
}

async function ResumenTab({ client }) {
  const now = new Date();
  const month = monthKey(now);
  const db = await getDb();
  // Operational state (inactive clients are not tracked: no row).
  const [ops, [goal]] = await Promise.all([
    getOperations({ now, clientId: client.id }),
    db.query(`SELECT contracted FROM client_month_goals WHERE client_id = $1 AND month = $2`, [client.id, month]),
  ]);
  const row = ops.clients[0];
  const contracted = goal ? goal.contracted : client.settings?.defaultMonthly || 0;
  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <div>
        {row ? <ClientOpsHeader row={row} now={now} /> : <p className="text-sm font-light text-ash">Cliente inactivo: no entra en el seguimiento operativo.</p>}
        <div className="mt-8">
          <p className="mb-2 text-[0.6rem] uppercase tracking-wider2 text-ash">Contratados este mes</p>
          <GoalForm key={`${month}-${contracted}`} clientId={client.id} month={month} contracted={contracted} />
        </div>
      </div>
      <section>
        <h2 className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">Datos del cliente</h2>
        <ClientForm initial={JSON.parse(JSON.stringify(client))} />
      </section>
    </div>
  );
}

async function CalendarioTab({ client, base, searchParams }) {
  const st = parseCalendarParams(searchParams);
  const tabBase = `${base}?tab=calendario`;
  const f = { clientId: client.id, platform: st.platform, status: st.status, type: st.type };
  const [items, undated] = await Promise.all([
    listContent({ ...f, range: viewRange(st.view, st.date) }),
    listContent({ ...f, undated: true }),
  ]);
  return (
    <>
      <div className="mb-6 flex gap-4 text-[0.68rem] uppercase tracking-wider2">
        {[["month", "Mes"], ["week", "Semana"], ["agenda", "Agenda"]].map(([v, l]) => (
          <Link key={v} href={calendarHref(tabBase, st, { view: v })} className={st.view === v ? "text-champagne" : "text-ash hover:text-bone"}>{l}</Link>
        ))}
      </div>
      <CalendarView
        view={st.view}
        anchor={st.date}
        items={items}
        undated={undated}
        href={(p) => calendarHref(tabBase, st, p)}
        newHref={(day) => `/studio/contenido/nuevo?client=${client.id}&date=${day}`}
      />
    </>
  );
}

async function ContenidosTab({ client }) {
  const items = await listContent({ clientId: client.id, limit: 200 });
  if (!items.length) return <p className="text-sm font-light text-ash">Este cliente todavía no tiene contenidos.</p>;
  return (
    <ul className="divide-y divide-edge border border-edge">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={`/studio/contenido/${it.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 p-3 text-sm font-light hover:bg-graphite">
            <span className="w-32 shrink-0 text-xs text-ash">{it.scheduledAt ? formatSlot(new Date(it.scheduledAt)) : "Sin fecha"}</span>
            <span className="min-w-0 flex-1 truncate">{it.title}</span>
            <span className="text-xs text-ash">{PLATFORM_LABEL[it.platform]}</span>
            <span className="flex items-center gap-2 text-xs text-ash"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />{STATUS_LABEL[it.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function ArchivosTab({ client }) {
  const [files, contents] = await Promise.all([listClientFiles(client.id), listContent({ clientId: client.id, limit: 200 })]);
  return (
    <FilesAdmin
      clientId={client.id}
      files={JSON.parse(JSON.stringify(files))}
      contents={contents.map((c) => ({ id: c.id, title: c.title }))}
      enabled={Boolean(filesMode())}
    />
  );
}

async function TareasTab({ client }) {
  const today = ymd(new Date());
  const tasks = await listTasks({ clientId: client.id, today });
  const groups = [
    ["Vencidas", (t) => ["pending", "in_progress"].includes(t.status) && t.due && t.due < today],
    ["Para el cliente", (t) => ["pending", "in_progress"].includes(t.status) && t.visibility === "client" && !(t.due && t.due < today)],
    ["Internas", (t) => ["pending", "in_progress"].includes(t.status) && t.visibility === "internal" && !(t.due && t.due < today)],
    ["Completadas y canceladas", (t) => !["pending", "in_progress"].includes(t.status)],
  ];
  return (
    <div className="space-y-10">
      <Link href={`/studio/tareas/nueva?client=${client.id}`} className="inline-block border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Nueva tarea</Link>
      {tasks.length === 0 && <p className="text-sm font-light text-ash">Este cliente no tiene tareas.</p>}
      {groups.map(([title, fn]) => {
        const list = tasks.filter(fn);
        return list.length ? (
          <section key={title}>
            <h2 className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">{title} · {list.length}</h2>
            <TaskTable tasks={list} today={today} showClient={false} />
          </section>
        ) : null;
      })}
    </div>
  );
}

function describe(a) {
  const d = a.data || {};
  if (a.event === "content.status_changed") return `${STATUS_LABEL[d.from] || d.from} → ${STATUS_LABEL[d.to] || d.to}`;
  if (a.event === "content.rescheduled") return `${d.from ? formatSlot(new Date(d.from)) : "sin fecha"} → ${d.to ? formatSlot(new Date(d.to)) : "sin fecha"}`;
  if (a.event === "access.regenerated") return d.sessionsRevoked ? `sesiones cerradas: ${d.count}` : "sesiones mantenidas";
  if (a.event === "sessions.revoked") return `${d.count} sesiones`;
  if (["content.approved", "content.changes_requested", "content.sent_for_review"].includes(a.event)) return `v${d.version}`;
  if (a.event === "content.manual_approval") return `${d.approverName} · ${d.channel}`;
  if (a.event === "content.approval_invalidated") return `v${d.fromVersion} → v${d.toVersion}`;
  if (a.event.startsWith("task.")) return d.title || "";
  if (a.event.startsWith("file.")) return `${d.name || ""}${d.version ? ` · v${d.version}` : ""}`;
  if (a.event === "goal.set") return `${d.month}: ${d.contracted}`;
  return "";
}

async function ActividadTab({ client }) {
  const rows = await listActivity(client.id, 100);
  if (!rows.length) return <p className="text-sm font-light text-ash">Sin actividad.</p>;
  return (
    <ul className="divide-y divide-edge border border-edge">
      {rows.map((a) => (
        <li key={a.seq} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 p-3 text-sm font-light">
          <span className="w-36 shrink-0 text-xs text-ash">{formatStamp(new Date(a.created_at))}</span>
          <span>{EVENT_LABEL[a.event] || a.event}</span>
          {a.content_title && <Link href={`/studio/contenido/${a.content_id}`} className="text-champagne hover:underline">{a.content_title}</Link>}
          <span className="text-xs text-ash">{describe(a)}</span>
          <span className="ml-auto text-xs text-ash">{a.actor_name}</span>
        </li>
      ))}
    </ul>
  );
}
