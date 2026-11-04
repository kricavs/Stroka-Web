import Link from "next/link";
import { groupByDay, groupByWeek, monthGrid, weekDays } from "@/lib/shared/calendar.js";
import { PLATFORM_LABEL, STATUS_COLOR, STATUS_LABEL } from "@/lib/shared/content.js";
import { addDays, addMonths, formatDayShort, formatMonthLong, ymd, zonedParts } from "@/lib/shared/time.js";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const hhmm = (iso) => {
  const p = zonedParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const at = (day) => new Date(`${day}T15:00:00Z`);

// Server component. `href(params)` builds the URL for navigation, `newHref(day)`
// the "create content on this day" link, `showClient` adds the client name.
export default function CalendarView({ view, anchor, items, undated, href, newHref, showClient }) {
  const today = ymd(new Date());
  const { byDay } = groupByDay(items);
  const chip = (it) => (
    <Link
      key={it.id}
      href={`/studio/contenido/${it.id}`}
      title={`${it.title} · ${STATUS_LABEL[it.status]}`}
      className="flex items-center gap-1.5 truncate text-[0.7rem] font-light hover:text-champagne"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
      <span className="shrink-0 text-ash">{hhmm(it.scheduledAt)}</span>
      <span className="truncate">{showClient ? `${it.clientName} · ` : ""}{it.title}</span>
    </Link>
  );

  const step = view === "month" ? { prev: addMonths(anchor.slice(0, 7), -1) + "-01", next: addMonths(anchor.slice(0, 7), 1) + "-01" }
    : { prev: addDays(anchor, view === "week" ? -7 : -42), next: addDays(anchor, view === "week" ? 7 : 42) };

  const title = view === "month" ? formatMonthLong(anchor.slice(0, 7)) : view === "week" ? `Semana del ${formatDayShort(at(weekDays(anchor)[0]))}` : `Desde el ${formatDayShort(at(anchor))}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-light uppercase tracking-wider2 capitalize text-bone">{title}</h2>
        <div className="flex items-center gap-5 text-[0.68rem] uppercase tracking-wider2 text-ash">
          <Link href={href({ date: step.prev })} className="hover:text-champagne">← Anterior</Link>
          <Link href={href({ date: today })} className="hover:text-champagne">Hoy</Link>
          <Link href={href({ date: step.next })} className="hover:text-champagne">Siguiente →</Link>
        </div>
      </div>

      {view === "month" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-7 gap-px border border-edge bg-edge">
            {DOW.map((d) => <div key={d} className="bg-ink px-2 py-2 text-[0.6rem] uppercase tracking-wider2 text-ash">{d}</div>)}
            {monthGrid(anchor.slice(0, 7)).flat().map((day) => {
              const list = byDay.get(day) || [];
              const inMonth = day.startsWith(anchor.slice(0, 7));
              return (
                <div key={day} className={`group min-h-[7.5rem] bg-panel p-2 ${inMonth ? "" : "opacity-40"}`}>
                  <div className="flex items-start justify-between">
                    <span className={`text-xs ${day === today ? "bg-champagne px-1.5 py-0.5 font-semibold text-ink" : "text-ash"}`}>{Number(day.slice(8))}</span>
                    <Link href={newHref(day)} aria-label={`Nuevo contenido el ${day}`} className="text-ash/0 hover:!text-champagne group-hover:text-ash/60">＋</Link>
                  </div>
                  <ul className="mt-1.5 space-y-1">{list.map((it) => <li key={it.id}>{chip(it)}</li>)}</ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-px border border-edge bg-edge md:grid-cols-7">
          {weekDays(anchor).map((day, i) => (
            <div key={day} className="min-h-[10rem] bg-panel p-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs uppercase tracking-wider2 ${day === today ? "text-champagne" : "text-ash"}`}>{DOW[i]} {Number(day.slice(8))}</span>
                <Link href={newHref(day)} aria-label={`Nuevo contenido el ${day}`} className="text-ash hover:text-champagne">＋</Link>
              </div>
              <ul className="mt-3 space-y-2">{(byDay.get(day) || []).map((it) => <li key={it.id}>{chip(it)}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {view === "agenda" && <Agenda items={items} showClient={showClient} />}

      <section className="mt-10">
        <h3 className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-champagne">Sin fecha</h3>
        {undated.length === 0 ? (
          <p className="text-sm font-light text-ash">No hay contenidos sin fecha.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((it) => (
              <li key={it.id}>
                <Link href={`/studio/contenido/${it.id}`} className="flex items-center gap-2 border border-edge bg-panel p-3 text-sm font-light hover:border-champagne">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
                  <span className="min-w-0 truncate">{showClient ? `${it.clientName} · ` : ""}{it.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Agenda({ items, showClient }) {
  const { weeks } = groupByWeek(items);
  if (!weeks.length) return <p className="text-sm font-light text-ash">No hay contenidos en este período.</p>;
  return (
    <div className="space-y-8">
      {weeks.map((w) => (
        <section key={w.start}>
          <h3 className="mb-3 text-[0.62rem] uppercase tracking-wider2 text-champagne">Semana del {formatDayShort(at(w.start))}</h3>
          <ul className="divide-y divide-edge border border-edge bg-panel">
            {w.days.flatMap((d) =>
              d.items.map((it) => (
                <li key={it.id}>
                  <Link href={`/studio/contenido/${it.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 p-3 text-sm font-light hover:bg-graphite">
                    <span className="w-24 shrink-0 text-ash">{formatDayShort(at(d.day))} · {hhmm(it.scheduledAt)}</span>
                    <span className="min-w-0 flex-1 truncate">{showClient ? `${it.clientName} · ` : ""}{it.title}</span>
                    <span className="text-xs text-ash">{PLATFORM_LABEL[it.platform]}</span>
                    <span className="flex items-center gap-2 text-xs text-ash"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />{STATUS_LABEL[it.status]}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
