import { monthGrid } from "@/lib/shared/calendar.js";
import { formatMonthLong } from "@/lib/shared/time.js";

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const TYPE_COLOR = { reel: "#5b9bff", carousel: "#d9a441", story: "#a78bd4", post: "#6fbf8e" };
export const SATURATED_AT = 3;

// Distribution of the draft over the month: busy days, empty days, Sundays.
// Pure render from draft items (skipped / errored items are drawn faded).
export default function MonthPreview({ period, items }) {
  const byDay = new Map();
  for (const it of items) {
    if (!it.date) continue;
    byDay.set(it.date, [...(byDay.get(it.date) || []), it]);
  }
  const weeks = monthGrid(period);
  const live = (it) => !it.skipped && it.validationStatus !== "error";
  return (
    <div>
      <p className="mb-3 text-[0.6rem] uppercase tracking-wider2 text-ash">{formatMonthLong(period)} · distribución</p>
      <div className="grid grid-cols-7 gap-px border border-edge bg-edge text-[0.6rem]">
        {DOW.map((d, i) => <div key={i} className="bg-ink px-1 py-1.5 text-center uppercase tracking-wider2 text-ash">{d}</div>)}
        {weeks.flat().map((day, idx) => {
          const list = byDay.get(day) || [];
          const inMonth = day.startsWith(period);
          const n = list.filter(live).length;
          const sunday = idx % 7 === 6;
          return (
            <div key={day} className={`min-h-[3.2rem] p-1 sm:min-h-[4.6rem] ${inMonth ? "bg-panel" : "bg-ink opacity-30"} ${n >= SATURATED_AT ? "outline outline-1 -outline-offset-1 outline-[#d9a441]" : ""}`}
                 title={n >= SATURATED_AT ? `${n} piezas: día cargado` : undefined}>
              <div className="flex items-start justify-between">
                <span className={`text-[0.65rem] ${sunday ? "text-ash/60" : "text-ash"}`}>{Number(day.slice(8))}</span>
                {n > 0 && <span className="text-[0.62rem] font-semibold" style={{ color: n >= SATURATED_AT ? "#d9a441" : undefined }}>{n}</span>}
              </div>
              {/* chips only where there is room; on phones the count is enough */}
              <ul className="mt-1 hidden space-y-0.5 sm:block">
                {list.map((it) => (
                  <li key={it.id} className={`flex items-center gap-1 truncate text-[0.6rem] ${live(it) ? "" : "opacity-40 line-through"}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[it.contentType] || "#6b6b70" }} />
                    <span className="truncate">{it.externalCode || it.title}</span>
                  </li>
                ))}
              </ul>
              {inMonth && n === 0 && <span className="mt-2 block text-center text-[0.55rem] text-ash/40 sm:mt-3">{sunday ? "dom" : ""}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.62rem] text-ash">
        {[["reel", "Reel"], ["carousel", "Carrusel"], ["story", "Historia"], ["post", "Pieza única"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLOR[k] }} />{l}</span>
        ))}
        <span>Borde ámbar: {SATURATED_AT}+ piezas en un día</span>
      </p>
    </div>
  );
}
