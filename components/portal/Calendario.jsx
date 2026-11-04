import Link from "next/link";
import { groupByDay, groupByWeek, monthGrid } from "@/lib/shared/calendar.js";
import { addMonths, formatDayShort, formatMonthLong, monthKey, monthRange, parseYmd, ymd, zonedParts } from "@/lib/shared/time.js";
import { listUndated, listVisible } from "@/lib/portal/server/content";
import { Eyebrow, StatusPill, Title, card } from "./ui";
import { STATUS_COLOR } from "@/lib/shared/content.js";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const hhmm = (iso) => {
  const p = zonedParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const dayLabel = (day) => {
  const p = parseYmd(day);
  return `${DOW[(new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7]} ${formatDayShort(new Date(Date.UTC(p.year, p.month - 1, p.day, 12)))}`;
};

export default async function Calendario({ scope, base, searchParams }) {
  const today = ymd(new Date());
  const requested = typeof searchParams?.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m) ? searchParams.m : monthKey(new Date());
  const month = requested;
  const { start, end } = monthRange(month);
  const [items, undated] = await Promise.all([listVisible(scope, { start, end }), listUndated(scope)]);
  const { byDay } = groupByDay(items);
  const { weeks } = groupByWeek(items);

  return (
    <>
      <Eyebrow>Calendario</Eyebrow>
      <Title>{formatMonthLong(month)}</Title>
      <div className="mt-5 flex gap-6 text-[0.68rem] uppercase tracking-wider2">
        <Link href={`${base}/calendario?m=${addMonths(month, -1)}`} className="text-[#9a9aa3] hover:text-[#f4f4f2]">← Anterior</Link>
        <Link href={`${base}/calendario`} className="text-[#9a9aa3] hover:text-[#f4f4f2]">Hoy</Link>
        <Link href={`${base}/calendario?m=${addMonths(month, 1)}`} className="text-[#9a9aa3] hover:text-[#f4f4f2]">Siguiente →</Link>
      </div>

      {/* Mobile: agenda grouped by week */}
      <div className="mt-8 space-y-8 md:hidden">
        {weeks.length === 0 && <p className="text-sm font-light text-[#9a9aa3]">No hay contenidos para este mes.</p>}
        {weeks.map((w) => (
          <section key={w.start}>
            <h2 className="mb-3 text-[0.62rem] uppercase tracking-wider2 text-[var(--accent)]">Semana del {formatDayShort(new Date(`${w.start}T15:00:00Z`))}</h2>
            <ul className="space-y-2">
              {w.days.flatMap((d) =>
                d.items.map((it) => (
                  <li key={it.id}>
                    <Link href={`${base}/contenido/${it.id}`} className={`${card} flex items-start gap-4 p-4`}>
                      <span className="w-14 shrink-0 text-xs font-light text-[#9a9aa3]">{dayLabel(d.day).replace(" ", " ")}<br />{hhmm(it.scheduledAt)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{it.title}</span>
                        <span className="mt-1 block"><StatusPill status={it.status} label={it.statusLabel} /></span>
                        {!it.minimal && <span className="mt-1 block text-xs font-light text-[#9a9aa3]">{it.platformLabel} · {it.typeLabel}</span>}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      {/* Desktop: month grid */}
      <div className="mt-8 hidden md:block">
        <div className="grid grid-cols-7 gap-px border border-[#2a2a31] bg-[#2a2a31]">
          {DOW.map((d) => (
            <div key={d} className="bg-[#16161a] px-2 py-2 text-[0.6rem] uppercase tracking-wider2 text-[#9a9aa3]">{d}</div>
          ))}
          {monthGrid(month).flat().map((day) => {
            const inMonth = day.startsWith(month);
            const list = byDay.get(day) || [];
            return (
              <div key={day} className={`min-h-[7.5rem] bg-[#1d1d22] p-2 ${inMonth ? "" : "opacity-40"}`}>
                <span className={`text-xs ${day === today ? "bg-[var(--accent)] px-1.5 py-0.5 font-semibold text-[#0a0a0b]" : "text-[#9a9aa3]"}`}>{Number(day.slice(8))}</span>
                <ul className="mt-1.5 space-y-1">
                  {list.map((it) => (
                    <li key={it.id}>
                      <Link href={`${base}/contenido/${it.id}`} className="flex items-center gap-1.5 truncate text-[0.7rem] font-light hover:text-[var(--accent)]" title={it.title}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
                        <span className="shrink-0 text-[#9a9aa3]">{hhmm(it.scheduledAt)}</span>
                        <span className="truncate">{it.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-[0.62rem] uppercase tracking-wider2 text-[var(--accent)]">Fecha a definir</h2>
          <ul className="space-y-2">
            {undated.map((it) => (
              <li key={it.id}>
                <Link href={`${base}/contenido/${it.id}`} className={`${card} flex items-center justify-between gap-4 p-4`}>
                  <span className="truncate text-sm">{it.title}</span>
                  <StatusPill status={it.status} label={it.statusLabel} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
