import Link from "next/link";
import PageHead from "@/components/studio/PageHead";
import { AlertRow, Block, ClientRow, ContentRow, Empty, LEVEL_COLOR, TaskRow } from "@/components/studio/ops/parts";
import { requireSession } from "@/lib/studio/server/auth";
import { getOperations } from "@/lib/studio/server/operations";
import { ALERTS_LIMIT } from "@/lib/operations/config.js";
import { agoLabel } from "@/lib/operations/rules.js";
import { formatDayShort } from "@/lib/shared/time.js";

const SEVERITY = { blocked: 0, late: 1, attention: 2, ok: 3 };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default async function StudioHome() {
  await requireSession();
  const now = new Date();
  const ops = await getOperations({ now });
  const { hoy } = ops;

  const alerts = ops.alerts.slice(0, ALERTS_LIMIT);
  const clients = [...ops.clients].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name));
  const summary = [
    hoy.tasks.length ? plural(hoy.tasks.length, "tarea", "tareas") : null,
    hoy.review.length ? plural(hoy.review.length, "contenido para revisar", "contenidos para revisar") : null,
    hoy.publications.length ? plural(hoy.publications.length, "publicación", "publicaciones") : null,
    hoy.waitingCount ? `${hoy.waitingCount} esperando respuesta del cliente` : null,
  ].filter(Boolean);
  const rowsShown = hoy.rows.publications.length + hoy.rows.tasks.length + hoy.rows.review.length;
  const critical = ops.alerts.filter((a) => a.level === "critical").length;

  return (
    <>
      <PageHead eyebrow={formatDayShort(now)} title="Hoy">
        <Link href="/studio/contenido/nuevo" className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Nuevo contenido</Link>
        <Link href="/studio/tareas/nueva" className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Nueva tarea</Link>
      </PageHead>

      {/* Mobile = DOM/`order` sequence; desktop = two editorial columns. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:col-start-1 lg:flex lg:flex-col lg:gap-5">
          <Block
            id="atencion"
            title="Requiere atención"
            count={ops.alerts.length}
            className="order-1"
            empty={alerts.length ? null : <Empty>Nada requiere atención. Todo en orden.</Empty>}
          >
            {critical > 0 && (
              <p className="-mt-1 mb-2 text-xs font-light" style={{ color: LEVEL_COLOR.critical }}>
                {plural(critical, "situación crítica", "situaciones críticas")}
              </p>
            )}
            <ul className="divide-y divide-edge">{alerts.map((a) => <AlertRow key={a.id} a={a} />)}</ul>
            {ops.alerts.length > alerts.length && <p className="mt-3 text-xs font-light text-ash">y {ops.alerts.length - alerts.length} más</p>}
          </Block>

          <Block id="hoy" title="Para hoy" className="order-2">
            {summary.length > 0 ? <p className="mb-3 text-sm font-light text-ash">{summary.join(" · ")}</p> : <Empty>Nada para hoy.</Empty>}
            {rowsShown > 0 && (
              <ul className="divide-y divide-edge">
                {hoy.rows.publications.map((it) => <ContentRow key={it.id} it={it} now={now} />)}
                {hoy.rows.tasks.map((t) => <TaskRow key={t.id} t={t} now={now} />)}
                {hoy.rows.review.map((it) => <ContentRow key={it.id} it={it} now={now} withDay />)}
              </ul>
            )}
            {rowsShown === 0 && summary.length > 0 && <p className="text-xs font-light text-ash">Lo de hoy ya figura arriba, en «Requiere atención».</p>}
          </Block>

          <Block
            id="proximos"
            title="Próximos 7 días"
            count={ops.upcoming.length}
            className="order-4"
            empty={ops.upcoming.length || ops.upcomingTasks.length ? null : <Empty>Sin publicaciones ni tareas próximas.</Empty>}
          >
            {ops.upcoming.length > 0 && <ul className="divide-y divide-edge">{ops.upcoming.map((it) => <ContentRow key={it.id} it={it} now={now} withDay risk={it.risk} />)}</ul>}
            {ops.upcomingTasks.length > 0 && (
              <>
                <h3 className="mb-1 mt-5 text-[0.6rem] uppercase tracking-wider2 text-ash">Tareas próximas</h3>
                <ul className="divide-y divide-edge">{ops.upcomingTasks.map((t) => <TaskRow key={t.id} t={t} now={now} />)}</ul>
              </>
            )}
          </Block>
        </div>

        <div className="contents lg:col-start-2 lg:flex lg:flex-col lg:gap-5">
          <Block
            id="clientes"
            title="Clientes"
            count={clients.length}
            className="order-3"
            empty={clients.length ? null : <Empty>Todavía no hay clientes activos.</Empty>}
          >
            <ul className="divide-y divide-edge">{clients.map((c) => <ClientRow key={c.id} c={c} />)}</ul>
          </Block>

          <Block id="esperando" title="Esperando al cliente" count={ops.waiting.length} className="order-5" empty={ops.waiting.length ? null : <Empty>Nada esperando respuesta.</Empty>}>
            <ul className="divide-y divide-edge">
              {ops.waiting.map((it) => (
                <li key={it.id}>
                  <Link href={`/studio/contenido/${it.id}`} className="flex items-baseline justify-between gap-3 py-2.5 text-sm font-light hover:text-champagne">
                    <span className="min-w-0 truncate">{it.clientName} · {it.title}</span>
                    <span className="shrink-0 text-xs" style={{ color: it.stale ? LEVEL_COLOR.warning : undefined }}>
                      {it.daysWaiting === null ? "—" : agoLabel(it.daysWaiting)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="actividad" title="Actividad" className="order-6" empty={ops.activity.length ? null : <Empty>Sin movimientos recientes.</Empty>}>
            <ul className="divide-y divide-edge">
              {ops.activity.map((a) => (
                <li key={a.seq}>
                  <Link href={a.href} className="flex gap-3 py-2.5 text-sm font-light hover:text-champagne">
                    <span className="w-14 shrink-0 text-xs text-ash">{a.when}</span>
                    <span className="min-w-0">
                      <span className="block">{a.text}</span>
                      <span className="block text-xs text-ash">{a.clientName}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      </div>
    </>
  );
}
