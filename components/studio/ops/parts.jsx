import Link from "next/link";
import { PLATFORM_LABEL, STATUS_COLOR, STATUS_LABEL, TASK_PRIORITY_LABEL } from "@/lib/shared/content.js";
import { OPERATIONAL_LABEL } from "@/lib/operations/config.js";
import { PACE_LABEL, dayDiff, whenLabel } from "@/lib/operations/rules.js";
import { formatDayShort, ymd, zonedParts } from "@/lib/shared/time.js";

// Alert colours: severity must be readable at a glance, not decorative.
export const LEVEL_COLOR = { critical: "#e5604d", warning: "#d9a441", attention: "#b9a388", info: "#6b6b70" };
export const OPERATIONAL_COLOR = { ok: "#6fbf8e", attention: "#b9a388", late: "#d9a441", blocked: "#e5604d" };

export const hhmm = (iso) => {
  const p = zonedParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

export function Block({ title, count, children, empty, id, className = "" }) {
  return (
    <section id={id} className={`border border-edge bg-panel p-5 ${className}`}>
      <h2 className="mb-4 flex items-baseline justify-between text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-champagne">
        {title}
        {count !== undefined && <span className="font-title text-2xl tracking-normal text-bone">{count}</span>}
      </h2>
      {children}
      {empty}
    </section>
  );
}

export const Empty = ({ children }) => <p className="text-sm font-light text-ash">{children}</p>;

// Thin editorial bar: solid = published, soft = planned (not yet published).
export function ProgressBar({ progress, className = "" }) {
  const { goal, planned, published } = progress;
  if (!goal) return <p className={`text-xs font-light text-ash ${className}`}>Sin objetivo configurado</p>;
  const w = (n) => `${Math.min(100, (n / goal) * 100)}%`;
  return (
    <div className={className} role="img" aria-label={`${planned} de ${goal} planificados, ${published} publicados`}>
      <div className="relative h-[3px] w-full bg-edge">
        <span className="absolute inset-y-0 left-0 bg-champagne/40" style={{ width: w(planned) }} />
        <span className="absolute inset-y-0 left-0 bg-champagne" style={{ width: w(published) }} />
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.64rem] uppercase tracking-wider2" style={{ color: OPERATIONAL_COLOR[status] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: OPERATIONAL_COLOR[status] }} />
      {OPERATIONAL_LABEL[status]}
    </span>
  );
}

export function AlertRow({ a }) {
  return (
    <li>
      <Link href={a.href} className="group flex gap-3 py-3 hover:bg-graphite/40">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[a.level] }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.2em]" style={{ color: LEVEL_COLOR[a.level] }}>{a.label}</span>
          <span className="block truncate text-sm group-hover:text-champagne">{a.kind !== "client" && a.clientName ? `${a.clientName} · ` : ""}{a.title}</span>
          <span className="block text-xs font-light text-ash">{a.detail}</span>
        </span>
      </Link>
    </li>
  );
}

export function ContentRow({ it, now, withDay = false, risk }) {
  return (
    <li>
      <Link href={`/studio/contenido/${it.id}`} className="flex items-start gap-3 py-2.5 text-sm font-light hover:text-champagne">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
        <span className="w-[4.6rem] shrink-0 pt-0.5 text-xs text-ash">{it.scheduledAt ? (withDay ? whenLabel(it.scheduledAt, now) : hhmm(it.scheduledAt)) : "Sin fecha"}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words sm:truncate">{it.clientName} · {it.title}</span>
          <span className="block text-xs text-ash">{STATUS_LABEL[it.status]} · {PLATFORM_LABEL[it.platform]}</span>
          {risk && <span className="block text-[0.64rem] uppercase tracking-wider2" style={{ color: LEVEL_COLOR[risk.level] }}>{risk.label}</span>}
        </span>
      </Link>
    </li>
  );
}

const dueLabel = (due, now) => {
  const d = dayDiff(ymd(now), due);
  return d === 0 ? "Hoy" : d === 1 ? "Mañana" : d === -1 ? "Ayer" : formatDayShort(new Date(`${due}T15:00:00Z`));
};

export function TaskRow({ t, now }) {
  const p = t.priority === "urgent" || t.priority === "high";
  return (
    <li>
      <Link href={`/studio/tareas/${t.id}`} className="flex items-start gap-3 py-2.5 text-sm font-light hover:text-champagne">
        <span className="mt-1 h-2 w-2 shrink-0 rotate-45 border border-ash" aria-hidden />
        <span className="w-[4.6rem] shrink-0 pt-0.5 text-xs text-ash">{t.due ? dueLabel(t.due, now) : "Sin fecha"}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words sm:truncate">{t.clientName ? `${t.clientName} · ` : ""}{t.title}</span>
          <span className="block text-xs text-ash">
            <span className={p ? "text-bone" : ""}>{TASK_PRIORITY_LABEL[t.priority]}</span>{t.assignee ? ` · ${t.assignee}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ClientRow({ c }) {
  const p = c.progress;
  const notes = [
    c.pending.changes ? `${c.pending.changes} ${c.pending.changes === 1 ? "cambio solicitado" : "cambios solicitados"}` : null,
    c.pending.approvals ? `${c.pending.approvals} por aprobar` : null,
    c.pending.tasks ? `${c.pending.tasks} ${c.pending.tasks === 1 ? "tarea" : "tareas"}` : null,
  ].filter(Boolean);
  return (
    <li>
      <Link href={`/studio/clientes/${c.id}`} className="block py-3 hover:bg-graphite/40">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm">{c.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-ash">
            {p.hasGoal ? <><span className="text-bone">{p.planned}</span> / {p.goal} <span className="ml-1">{p.pct}%</span></> : "Sin objetivo"}
          </span>
        </span>
        <ProgressBar progress={p} className="mt-2" />
        <span className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <StatusPill status={c.status} />
          <span className="text-xs font-light text-ash">
            {notes.length ? notes.join(" · ") : c.status === "ok" ? "Al día" : PACE_LABEL[p.pace]}
          </span>
        </span>
      </Link>
    </li>
  );
}
