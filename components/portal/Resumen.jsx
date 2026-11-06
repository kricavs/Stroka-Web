import Link from "next/link";
import { formatMonthLong, formatSlot, monthKey } from "@/lib/shared/time.js";
import { getProfile, monthSummary, nextPublication, pendingCounts } from "@/lib/portal/server/content";
import { deliverableCount } from "@/lib/portal/server/files";
import { Eyebrow, StatusPill, Title, card } from "./ui";

export default async function Resumen({ scope, base }) {
  const now = new Date();
  const month = monthKey(now);
  const profile = await getProfile(scope);
  const [summary, next, pending, deliverables] = await Promise.all([
    monthSummary(scope, month, profile.defaultMonthly),
    nextPublication(scope, now),
    pendingCounts(scope),
    deliverableCount(scope),
  ]);
  const [monthName] = formatMonthLong(month).split(" ");

  return (
    <>
      <Eyebrow>Hola, {profile.displayName}</Eyebrow>
      <Title>{monthName}</Title>

      <section className={`${card} mt-8 p-6 sm:p-8`}>
        {summary.contracted > 0 ? (
          <p className="text-sm font-light text-[#9a9aa3]">
            <span className="mr-2 font-title text-3xl text-[#f4f4f2]">{summary.contracted}</span>
            contenidos contratados
          </p>
        ) : (
          <p className="text-sm font-light text-[#9a9aa3]">Todavía no hay una cantidad mensual definida.</p>
        )}
        <dl className="mt-6 grid grid-cols-3 gap-4 text-center sm:max-w-md">
          {[
            ["Publicados", summary.published],
            ["Programados", summary.scheduled],
            ["En producción", summary.production],
          ].map(([label, n]) => (
            <div key={label} className="border-t border-[#2a2a31] pt-3">
              <dd className="font-title text-4xl leading-none">{n}</dd>
              <dt className="mt-2 text-[0.6rem] uppercase tracking-wider2 text-[#9a9aa3]">{label}</dt>
            </div>
          ))}
        </dl>
        {summary.review > 0 && (
          <p className="mt-5 text-sm font-light text-[#9a9aa3]">
            {summary.review} {summary.review === 1 ? "contenido en revisión" : "contenidos en revisión"}
          </p>
        )}
        {summary.progress !== null && (
          <div className="mt-7">
            <div className="h-1.5 w-full bg-[#2a2a31]" role="progressbar" aria-valuenow={summary.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[var(--accent)]" style={{ width: `${summary.progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-light text-[#9a9aa3]">{summary.progress}% completado</p>
          </div>
        )}
      </section>

      <section className={`${card} mt-5 p-6 sm:p-8`}>
        <p className="text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Pendientes</p>
        {pending.review + pending.tasks > 0 ? (
          <>
            <ul className="mt-3 space-y-1 text-sm font-light">
              {pending.review > 0 && <li>{pending.review} {pending.review === 1 ? "contenido para revisar" : "contenidos para revisar"}</li>}
              {pending.tasks > 0 && <li>{pending.tasks} {pending.tasks === 1 ? "tarea pendiente" : "tareas pendientes"}</li>}
            </ul>
            <Link href={`${base}/pendientes`} className="mt-4 inline-flex min-h-[44px] items-center text-[0.7rem] font-semibold uppercase tracking-wider2 text-[var(--accent)] hover:text-[#f4f4f2]">
              Ver pendientes →
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm font-light text-[#9a9aa3]">No tenés nada pendiente.</p>
        )}
      </section>

      <section className={`${card} mt-5 p-6 sm:p-8`}>
        <p className="text-[0.62rem] uppercase tracking-wider2 text-[#9a9aa3]">Próxima publicación</p>
        {next ? (
          <Link href={`${base}/contenido/${next.id}`} className="mt-3 block hover:opacity-80">
            <p className="font-title text-2xl uppercase tracking-wide">{next.title}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-light text-[#c9c9cf]">
              <span>{formatSlot(new Date(next.scheduledAt))}</span>
              {!next.minimal && <span>{next.platformLabel} · {next.typeLabel}</span>}
              <StatusPill status={next.status} label={next.statusLabel} />
            </p>
          </Link>
        ) : (
          <p className="mt-3 text-sm font-light text-[#9a9aa3]">No hay publicaciones próximas por ahora.</p>
        )}
      </section>

      {deliverables > 0 && (
        <section className={`${card} mt-5 p-6 sm:p-8`}>
          <p className="text-sm font-light">{deliverables} {deliverables === 1 ? "entregable disponible" : "entregables disponibles"}</p>
          <Link href={`${base}/archivos`} className="mt-3 inline-flex min-h-[44px] items-center text-[0.7rem] font-semibold uppercase tracking-wider2 text-[var(--accent)] hover:text-[#f4f4f2]">Ver archivos →</Link>
        </section>
      )}

      <Link href={`${base}/calendario`} className="mt-6 inline-block text-[0.7rem] uppercase tracking-wider2 text-[var(--accent)] hover:text-[#f4f4f2]">
        Ver calendario →
      </Link>
    </>
  );
}
