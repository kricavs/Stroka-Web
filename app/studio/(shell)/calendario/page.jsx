import Link from "next/link";
import CalendarView from "@/components/studio/CalendarView";
import PageHead from "@/components/studio/PageHead";
import { Button, Select } from "@/components/studio/ui";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { listContent } from "@/lib/studio/server/content";
import { viewRange } from "@/lib/shared/calendar.js";
import { calendarHref, parseCalendarParams } from "@/lib/studio/calendar-params.js";
import { CONTENT_TYPES, PLATFORMS, STATUSES, STATUS_LABEL } from "@/lib/shared/content.js";

export default async function CalendarPage({ searchParams }) {
  await requireSession();
  const st = parseCalendarParams(searchParams);
  const f = { clientId: st.client, platform: st.platform, status: st.status, type: st.type };
  const [clients, items, undated] = await Promise.all([
    clientOptions(),
    listContent({ ...f, range: viewRange(st.view, st.date) }),
    listContent({ ...f, undated: true }),
  ]);
  const base = "/studio/calendario";
  const newHref = (day) => `/studio/contenido/nuevo?date=${day}${st.client ? `&client=${st.client}` : ""}`;

  return (
    <>
      <PageHead eyebrow="Operación" title="Calendario">
        <Link href={newHref("")} className="bg-champagne px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-ink hover:bg-bone">Nuevo contenido</Link>
      </PageHead>

      <div className="mb-6 flex gap-4 text-[0.68rem] uppercase tracking-wider2">
        {[["month", "Mes"], ["week", "Semana"], ["agenda", "Agenda"]].map(([v, l]) => (
          <Link key={v} href={calendarHref(base, st, { view: v })} className={st.view === v ? "text-champagne" : "text-ash hover:text-bone"}>{l}</Link>
        ))}
      </div>

      <form method="get" action={base} className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="view" value={st.view} />
        <input type="hidden" name="date" value={st.date} />
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
      />
    </>
  );
}
