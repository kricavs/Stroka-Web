import Link from "next/link";
import { notFound } from "next/navigation";
import AccessPanel from "@/components/studio/AccessPanel";
import CalendarView from "@/components/studio/CalendarView";
import ClientForm from "@/components/studio/ClientForm";
import GoalForm from "@/components/studio/GoalForm";
import PageHead from "@/components/studio/PageHead";
import { requireSession } from "@/lib/studio/server/auth";
import { getClient, listActivity } from "@/lib/studio/server/clients";
import { clientMonthStats, listContent } from "@/lib/studio/server/content";
import { getDb } from "@/lib/studio/server/db";
import { viewRange } from "@/lib/shared/calendar.js";
import { calendarHref, parseCalendarParams } from "@/lib/studio/calendar-params.js";
import { EVENT_LABEL, PLATFORM_LABEL, STATUS_COLOR, STATUS_LABEL, SUMMARY_BUCKETS, progressPct } from "@/lib/shared/content.js";
import { formatMonthLong, formatSlot, formatStamp, monthKey, monthRange } from "@/lib/shared/time.js";

const TABS = [
  ["resumen", "Resumen"],
  ["calendario", "Calendario"],
  ["contenidos", "Contenidos"],
  ["acceso", "Acceso"],
  ["actividad", "Actividad"],
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
      {tab === "acceso" && <AccessPanel client={JSON.parse(JSON.stringify(client))} justCreated={searchParams.nuevo === "1"} />}
      {tab === "actividad" && <ActividadTab client={client} />}
    </>
  );
}

async function ResumenTab({ client }) {
  const month = monthKey(new Date());
  const stats = await clientMonthStats(client.id, monthRange(month));
  const db = await getDb();
  const [goal] = await db.query(`SELECT contracted FROM client_month_goals WHERE client_id = $1 AND month = $2`, [client.id, month]);
  const contracted = goal ? goal.contracted : client.settings?.defaultMonthly || 0;
  const sum = (l) => l.reduce((n, s) => n + (stats[s] || 0), 0);
  const published = sum(SUMMARY_BUCKETS.published);
  const pct = progressPct(published, contracted);
  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <section>
        <h2 className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">{formatMonthLong(month)}</h2>
        <dl className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {[["Idea", stats.idea || 0], ["Producción", sum(["production", "review"])], ["Con cliente", sum(SUMMARY_BUCKETS.review)], ["Programado", sum(SUMMARY_BUCKETS.scheduled)], ["Publicado", published]].map(([l, n]) => (
            <div key={l} className="border-t border-edge pt-3"><dd className="font-title text-4xl leading-none">{n}</dd><dt className="mt-2 text-[0.58rem] uppercase tracking-wider2 text-ash">{l}</dt></div>
          ))}
        </dl>
        {pct !== null && <p className="mt-5 text-sm font-light text-ash">{pct}% completado ({published} de {contracted})</p>}
        <div className="mt-6">
          <p className="mb-2 text-[0.6rem] uppercase tracking-wider2 text-ash">Contratados este mes</p>
          <GoalForm key={`${month}-${contracted}`} clientId={client.id} month={month} contracted={contracted} />
        </div>
      </section>
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

function describe(a) {
  const d = a.data || {};
  if (a.event === "content.status_changed") return `${STATUS_LABEL[d.from] || d.from} → ${STATUS_LABEL[d.to] || d.to}`;
  if (a.event === "content.rescheduled") return `${d.from ? formatSlot(new Date(d.from)) : "sin fecha"} → ${d.to ? formatSlot(new Date(d.to)) : "sin fecha"}`;
  if (a.event === "access.regenerated") return d.sessionsRevoked ? `sesiones cerradas: ${d.count}` : "sesiones mantenidas";
  if (a.event === "sessions.revoked") return `${d.count} sesiones`;
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
