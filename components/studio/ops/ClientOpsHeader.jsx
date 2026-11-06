import Link from "next/link";
import { PLATFORM_LABEL, TYPE_LABEL } from "@/lib/shared/content.js";
import { formatMonthLong } from "@/lib/shared/time.js";
import { PACE_LABEL, whenLabel } from "@/lib/operations/rules.js";
import { AlertRow, ProgressBar, StatusPill } from "./parts";

// Operational header of one client (Resumen tab). `row` = one entry of buildOperations().clients.
export default function ClientOpsHeader({ row, now }) {
  const p = row.progress;
  const parts = [
    [p.published, "publicados"],
    [p.scheduled, "programados"],
    [p.inProduction, "en producción"],
    [p.withClient, "con el cliente"],
  ];
  const pend = [
    [row.pending.approvals, "aprobación", "aprobaciones"],
    [row.pending.changes, "cambio solicitado", "cambios solicitados"],
    [row.pending.tasks, "tarea", "tareas"],
  ].filter(([n]) => n > 0);
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">{formatMonthLong(p.month)}</h2>
        <StatusPill status={row.status} />
      </div>

      {p.hasGoal ? (
        <>
          <p className="mt-4 font-title text-5xl leading-none">{p.planned}<span className="text-ash"> / {p.goal}</span></p>
          <p className="mt-2 text-xs uppercase tracking-wider2 text-ash">contenidos planificados · {p.pct}%</p>
        </>
      ) : (
        <p className="mt-4 font-title text-3xl leading-none text-ash">Sin objetivo configurado</p>
      )}
      <ProgressBar progress={p} className="mt-4" />
      <p className="mt-3 text-sm font-light text-ash">
        {parts.map(([n, l], i) => <span key={l}>{i ? " · " : ""}<span className="text-bone">{n}</span> {l}</span>)}
      </p>
      {p.hasGoal && p.pace !== "early" && p.pace !== "done" && <p className="mt-1 text-xs font-light text-ash">{PACE_LABEL[p.pace]} · se esperan ~{Math.round(p.expected)} a esta altura del mes</p>}
      {p.pace === "done" && <p className="mt-1 text-xs font-light text-ash">Objetivo del mes cumplido</p>}

      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Pendientes</dt>
          <dd className="mt-1 text-sm font-light">
            {pend.length ? pend.map(([n, one, many], i) => <span key={one}>{i ? " · " : ""}{n} {n === 1 ? one : many}</span>) : <span className="text-ash">Nada pendiente</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wider2 text-ash">Próxima publicación</dt>
          <dd className="mt-1 text-sm font-light">
            {row.next ? (
              <Link href={`/studio/contenido/${row.next.id}`} className="hover:text-champagne">
                {whenLabel(row.next.scheduledAt, now)} · {TYPE_LABEL[row.next.contentType]} · {PLATFORM_LABEL[row.next.platform]}
              </Link>
            ) : <span className="text-ash">Ninguna programada</span>}
          </dd>
        </div>
      </dl>

      {row.alerts.length > 0 && (
        <ul className="mt-6 divide-y divide-edge border-t border-edge">{row.alerts.map((a) => <AlertRow key={a.id} a={a} />)}</ul>
      )}
    </section>
  );
}
