// Operational rules for the Studio dashboard. PURE: no db, no React, no clock
// (every function receives `now`). All day maths go through lib/shared/time.js
// in the business zone (America/Argentina/Buenos_Aires), never the server's zone.
//
// Alerts are DERIVED from current data on every request (no table, nothing to
// keep in sync, nothing can go stale). All thresholds live in ./config.js.
import { STATUS_LABEL } from "../shared/content.js";
import { APP_TIMEZONE, addDays, addMonths, dayRange, formatSlot, monthKey, parseYmd, ymd, zonedParts } from "../shared/time.js";
import * as C from "./config.js";

const HOUR = 3600_000;
const dayOf = (v, tz = APP_TIMEZONE) => ymd(new Date(v), tz);

// Whole calendar days from a to b ('YYYY-MM-DD'), b later → positive.
export function dayDiff(a, b) {
  const pa = parseYmd(a), pb = parseYmd(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86400000);
}

export function daysInMonth(monthStr) {
  return Number(addDays(`${addMonths(monthStr, 1)}-01`, -1).slice(8));
}

// "hoy 18:00" · "mañana 18:00" · "ayer 18:00" · "08 NOV · 18:00"
export function whenLabel(iso, now, tz = APP_TIMEZONE) {
  const d = new Date(iso);
  const diff = dayDiff(ymd(now, tz), ymd(d, tz));
  const p = zonedParts(d, tz);
  const hhmm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  if (diff === 0) return `hoy ${hhmm}`;
  if (diff === 1) return `mañana ${hhmm}`;
  if (diff === -1) return `ayer ${hhmm}`;
  return formatSlot(d, tz);
}

export const agoLabel = (days) => (days <= 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`);

// ---- monthly progress -----------------------------------------------------

const PLANNED_EXCLUDED = (idea) => (idea ? ["cancelled"] : ["cancelled", "idea"]);

// goal: number | null (null = "Sin objetivo configurado": never 0, never alerts).
// counts: { status: n } for items scheduled in the month.
export function getClientMonthProgress({ goal, counts = {}, now, tz = APP_TIMEZONE }) {
  const month = monthKey(now, tz);
  const n = (s) => counts[s] || 0;
  const excluded = PLANNED_EXCLUDED(C.PLANNED_INCLUDES_IDEAS);
  const planned = Object.entries(counts).reduce((sum, [s, v]) => (excluded.includes(s) ? sum : sum + v), 0);
  const g = Number.isFinite(goal) && goal > 0 ? goal : null;
  const out = {
    month,
    goal: g,
    hasGoal: g !== null,
    planned,
    published: n("published"),
    scheduled: n("approved") + n("scheduled"),
    inProduction: n("production") + n("review"),
    withClient: n("client_review") + n("changes_requested"),
    ideas: n("idea"),
    pct: g ? Math.min(100, Math.round((planned / g) * 100)) : null,
    publishedPct: g ? Math.min(100, Math.round((n("published") / g) * 100)) : null,
    expected: null,
    deficit: null,
    pace: "none", // none | early | done | ahead | ok | low | behind
  };
  if (!g) return out;
  const p = zonedParts(now, tz);
  const ratio = p.day / daysInMonth(month);
  out.expected = g * ratio;
  out.deficit = out.expected - planned;
  if (planned >= g) out.pace = "done";
  else if (p.day < C.PACE_GRACE_DAYS) out.pace = "early";
  else {
    const tol = Math.max(C.PACE_TOLERANCE_MIN, g * C.PACE_TOLERANCE_RATIO);
    if (out.deficit <= -tol) out.pace = "ahead";
    else if (out.deficit <= tol) out.pace = "ok";
    else if (out.deficit <= 2 * tol) out.pace = "low";
    else out.pace = "behind";
  }
  return out;
}

export const PACE_LABEL = { none: "Sin objetivo configurado", early: "Inicio de mes", done: "Objetivo cumplido", ahead: "Adelantado", ok: "En ritmo", low: "Ritmo bajo", behind: "Atrasado" };

// ---- content --------------------------------------------------------------

const isSafe = (status) => C.SAFE_STATUSES.includes(status);
const live = (it) => it.status !== "cancelled";

// Reasons a content item needs attention (excluding "no date", which is
// aggregated per client). Each: { code, level, label, text, at }.
export function getContentReasons(it, now, tz = APP_TIMEZONE) {
  if (!live(it) || it.status === "published") return [];
  const out = [];
  const at = it.scheduledAt ? new Date(it.scheduledAt) : null;
  const ms = at ? at.getTime() - now.getTime() : null;
  const today = ymd(now, tz);

  if (at && !isSafe(it.status) && ms <= C.PUBLICATION_RISK_HOURS * HOUR) {
    out.push({
      code: "publication_at_risk", level: "critical", label: "Publicación en riesgo",
      text: `${ms < 0 ? "Fecha vencida" : whenLabel(at, now, tz)} · ${STATUS_LABEL[it.status]}`, at,
    });
  } else if (at && !isSafe(it.status) && ms <= C.CONTENT_UPCOMING_DAYS * 24 * HOUR) {
    out.push({ code: "upcoming_unapproved", level: "attention", label: "Próximo sin aprobar", text: `${whenLabel(at, now, tz)} · ${STATUS_LABEL[it.status]}`, at });
  }
  if (at && (it.status === "approved" || it.status === "scheduled") && ms < 0) {
    out.push({ code: "overdue_unpublished", level: "warning", label: "Sin publicar", text: `Debía publicarse ${whenLabel(at, now, tz)}`, at });
  }
  if (it.status === "changes_requested") {
    const since = it.changeRequestedAt ? dayDiff(dayOf(it.changeRequestedAt, tz), today) : null;
    const who = it.changeRequestedBy ? `pedidos por ${it.changeRequestedBy}` : "pedidos por el cliente";
    out.push({
      code: "changes_requested", level: "warning", label: "Cambios solicitados",
      text: since === null ? `Cambios ${who}` : `Cambios ${who} ${agoLabel(since)}`, at: it.changeRequestedAt ? new Date(it.changeRequestedAt) : at,
    });
  }
  if (it.status === "client_review" && it.sentToClientAt) {
    const days = dayDiff(dayOf(it.sentToClientAt, tz), today);
    if (days >= C.CLIENT_REVIEW_STALE_DAYS) {
      out.push({ code: "stale_review", level: "warning", label: "Aprobación estancada", text: `Esperando aprobación ${agoLabel(days)}`, at: new Date(it.sentToClientAt) });
    }
  }
  return out;
}

const topLevel = (reasons) => reasons.reduce((m, r) => (C.LEVEL_RANK[r.level] > C.LEVEL_RANK[m] ? r.level : m), "info");

// Highest-severity reason or null. (Convenience over getContentReasons.)
export function getContentRisk(it, now, tz) {
  const rs = getContentReasons(it, now, tz);
  if (!rs.length) return null;
  return [...rs].sort((a, b) => C.LEVEL_RANK[b.level] - C.LEVEL_RANK[a.level])[0];
}

// client_review items with how long they have waited (oldest first).
export function getWaitingApprovals(content, now, tz = APP_TIMEZONE) {
  const today = ymd(now, tz);
  return content
    .filter((it) => it.status === "client_review")
    .map((it) => {
      const days = it.sentToClientAt ? dayDiff(dayOf(it.sentToClientAt, tz), today) : null;
      return { ...it, daysWaiting: days, stale: days !== null && days >= C.CLIENT_REVIEW_STALE_DAYS };
    })
    .sort((a, b) => (b.daysWaiting ?? -1) - (a.daysWaiting ?? -1));
}
export const getStaleApprovals = (content, now, tz) => getWaitingApprovals(content, now, tz).filter((i) => i.stale);

// Publications in the next N days after today (cancelled/published excluded), soonest first.
export function getUpcomingItems(content, now, { days = C.CONTENT_UPCOMING_DAYS, tz = APP_TIMEZONE } = {}) {
  const today = ymd(now, tz);
  const start = dayRange(addDays(today, 1), tz).start;
  const end = dayRange(addDays(today, days + 1), tz).start;
  return content
    .filter((it) => live(it) && it.status !== "published" && it.scheduledAt)
    .filter((it) => new Date(it.scheduledAt) >= start && new Date(it.scheduledAt) < end)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .map((it) => ({ ...it, risk: getContentRisk(it, now, tz) }));
}

// ---- tasks ----------------------------------------------------------------

const OPEN = ["pending", "in_progress"];
export const isOpenTask = (t) => OPEN.includes(t.status);

export function getTaskRisk(t, now, tz = APP_TIMEZONE) {
  if (!isOpenTask(t) || !t.due) return null;
  const diff = dayDiff(ymd(now, tz), t.due); // negative = overdue
  const urgent = t.priority === "urgent";
  if (diff < 0) {
    return urgent
      ? { code: "task_urgent_overdue", level: "critical", label: "Tarea urgente vencida", text: `Vencida ${agoLabel(-diff)}`, diff }
      : { code: "task_overdue", level: "warning", label: "Tarea vencida", text: `Vencida ${agoLabel(-diff)}`, diff };
  }
  if (diff === 0) return urgent ? { code: "task_urgent_today", level: "warning", label: "Tarea urgente", text: "Vence hoy", diff } : null;
  if (diff <= C.TASK_DUE_SOON_DAYS) return { code: "task_due_soon", level: "attention", label: "Tarea vence pronto", text: diff === 1 ? "Vence mañana" : `Vence en ${diff} días`, diff };
  return null;
}

// overdue / today / upcoming(next N days) buckets of OPEN tasks, most urgent first.
export function getTaskBuckets(tasks, now, { days = C.TASK_UPCOMING_DAYS, tz = APP_TIMEZONE } = {}) {
  const today = ymd(now, tz);
  const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
  const open = tasks.filter((t) => isOpenTask(t) && t.due);
  const by = (a, b) => a.due.localeCompare(b.due) || rank[a.priority] - rank[b.priority];
  return {
    overdue: open.filter((t) => t.due < today).sort(by),
    today: open.filter((t) => t.due === today).sort(by),
    upcoming: open.filter((t) => t.due > today && dayDiff(today, t.due) <= days).sort(by),
    undated: tasks.filter((t) => isOpenTask(t) && !t.due),
  };
}

// ---- alerts ---------------------------------------------------------------

const href = {
  content: (id) => `/studio/contenido/${id}`,
  task: (id) => `/studio/tareas/${id}`,
  client: (id) => `/studio/clientes/${id}`,
};

// A change-request task that belongs to a content item still in changes_requested
// is shown INSIDE that content's alert, never as a second row.
function linkedChangeTasks(tasks, content) {
  const open = new Map(content.filter((c) => c.status === "changes_requested").map((c) => [c.id, c]));
  const byContent = new Map();
  for (const t of tasks) {
    if (isOpenTask(t) && t.kind === "change_request" && t.contentId && open.has(t.contentId)) byContent.set(t.contentId, t);
  }
  return byContent;
}

function taskStateText(t, now, tz) {
  const r = getTaskRisk(t, now, tz);
  if (!t.due) return "tarea sin fecha límite";
  return `tarea: ${(r ? r.text : `vence ${formatSlot(new Date(`${t.due}T15:00:00Z`), tz).slice(0, 6)}`).toLowerCase()}`;
}

/**
 * snapshot: { clients:[{id,name,progress}], content:[…], tasks:[…], lastActivity:{clientId: iso} }
 * Returns alerts sorted by severity (critical first), then by date.
 */
export function getDashboardAlerts(snapshot, now, tz = APP_TIMEZONE) {
  const { clients, content, tasks } = snapshot;
  const alerts = [];
  const linked = linkedChangeTasks(tasks, content);

  for (const it of content) {
    const reasons = getContentReasons(it, now, tz);
    if (!reasons.length) continue;
    reasons.sort((a, b) => C.LEVEL_RANK[b.level] - C.LEVEL_RANK[a.level]);
    const t = linked.get(it.id);
    const parts = reasons.map((r) => r.text);
    if (t) parts.push(taskStateText(t, now, tz));
    alerts.push({
      id: `content:${it.id}`, kind: "content", entityId: it.id, level: topLevel(reasons), code: reasons[0].code,
      label: reasons[0].label, title: it.title, clientId: it.clientId, clientName: it.clientName,
      detail: parts.join(" · "), href: href.content(it.id), sortAt: (reasons[0].at || new Date(it.scheduledAt || 0)).getTime(),
      codes: reasons.map((r) => r.code), linkedTaskId: t?.id || null,
    });
  }

  for (const t of tasks) {
    if (linked.get(t.contentId)?.id === t.id) continue;
    const r = getTaskRisk(t, now, tz);
    if (!r) continue;
    alerts.push({
      id: `task:${t.id}`, kind: "task", entityId: t.id, level: r.level, code: r.code, label: r.label, title: t.title,
      clientId: t.clientId, clientName: t.clientName, detail: [r.text, t.contentTitle].filter(Boolean).join(" · "),
      href: href.task(t.id), sortAt: new Date(`${t.due}T12:00:00Z`).getTime(),
    });
  }

  for (const c of clients) {
    const p = c.progress;
    if (p.pace === "low" || p.pace === "behind") {
      alerts.push({
        id: `pace:${c.id}`, kind: "client", entityId: c.id, level: p.pace === "behind" ? "warning" : "attention", code: `pace_${p.pace}`,
        label: p.pace === "behind" ? "Atrasado en el mes" : "Ritmo bajo", title: c.name, clientId: c.id, clientName: c.name,
        detail: `${p.planned} de ${p.goal} planificados · a esta altura se esperan ~${Math.round(p.expected)}`, href: href.client(c.id), sortAt: 0,
      });
    }
    const undated = content.filter((it) => it.clientId === c.id && !it.scheduledAt && C.NEEDS_DATE_STATUSES.includes(it.status));
    if (undated.length) {
      alerts.push({
        id: `undated:${c.id}`, kind: "client", entityId: c.id, level: "attention", code: "undated", label: "Sin fecha", title: c.name,
        clientId: c.id, clientName: c.name, detail: `${undated.length} ${undated.length === 1 ? "contenido sin fecha" : "contenidos sin fecha"}`,
        href: `/studio/calendario?client=${c.id}`, sortAt: 0,
      });
    }
    const last = snapshot.lastActivity?.[c.id];
    if (last) {
      const idle = dayDiff(dayOf(last, tz), ymd(now, tz));
      if (idle >= C.CLIENT_INACTIVITY_DAYS) {
        alerts.push({
          id: `idle:${c.id}`, kind: "client", entityId: c.id, level: "info", code: "client_idle", label: "Sin actividad", title: c.name,
          clientId: c.id, clientName: c.name, detail: `Sin movimientos ${agoLabel(idle)}`, href: href.client(c.id), sortAt: 0,
        });
      }
    }
  }

  return alerts.sort((a, b) => C.LEVEL_RANK[b.level] - C.LEVEL_RANK[a.level] || (a.sortAt || Infinity) - (b.sortAt || Infinity) || a.id.localeCompare(b.id));
}

// ---- client status --------------------------------------------------------

// blocked > late > attention > ok. `info` alerts never change the state.
// (This is the OPERATIONAL state; unrelated to access locking.)
export function getClientOperationalStatus({ alerts, progress }) {
  if (alerts.some((a) => a.level === "critical")) return "blocked";
  if (progress?.pace === "behind") return "late";
  if (alerts.some((a) => a.level === "warning" || a.level === "attention")) return "attention";
  return "ok";
}

// ---- everything the dashboard needs, from one snapshot ---------------------

export function buildOperations(snapshot, now, tz = APP_TIMEZONE) {
  const clients = snapshot.clients.map((c) => ({
    ...c,
    progress: getClientMonthProgress({ goal: c.goal, counts: c.monthCounts, now, tz }),
  }));
  const snap = { ...snapshot, clients };
  const alerts = getDashboardAlerts(snap, now, tz);
  const linked = linkedChangeTasks(snapshot.tasks, snapshot.content);
  const linkedIds = new Set([...linked.values()].map((t) => t.id));
  const tasks = snapshot.tasks.filter((t) => !linkedIds.has(t.id));
  const buckets = getTaskBuckets(tasks, now, { tz });
  const today = ymd(now, tz);
  const range = dayRange(today, tz);

  const inAlerts = new Set(alerts.filter((a) => C.LEVEL_RANK[a.level] >= C.LEVEL_RANK.warning).map((a) => a.id));
  const todayPubs = snapshot.content
    .filter((it) => live(it) && it.scheduledAt && new Date(it.scheduledAt) >= range.start && new Date(it.scheduledAt) < range.end)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const toReview = snapshot.content.filter((it) => it.status === "review");
  const waiting = getWaitingApprovals(snapshot.content, now, tz);
  const todayTasks = [...buckets.overdue, ...buckets.today];

  const byClient = (id) => alerts.filter((a) => a.clientId === id);
  const clientRows = clients.map((c) => {
    const al = byClient(c.id);
    const mine = snapshot.content.filter((it) => it.clientId === c.id);
    const next = mine
      .filter((it) => live(it) && !["idea", "published"].includes(it.status) && it.scheduledAt && new Date(it.scheduledAt) >= now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;
    return {
      ...c,
      status: getClientOperationalStatus({ alerts: al, progress: c.progress }),
      alerts: al,
      pending: {
        approvals: mine.filter((it) => it.status === "client_review").length,
        changes: mine.filter((it) => it.status === "changes_requested").length,
        tasks: tasks.filter((t) => t.clientId === c.id && isOpenTask(t)).length,
      },
      next,
    };
  });

  return {
    now, today, alerts, clients: clientRows,
    hoy: {
      publications: todayPubs, tasks: todayTasks, review: toReview,
      // Rows already shown as warning/critical in "Requiere atención" are not repeated.
      rows: {
        publications: todayPubs.filter((it) => !inAlerts.has(`content:${it.id}`)),
        tasks: todayTasks.filter((t) => !inAlerts.has(`task:${t.id}`)),
        review: toReview.filter((it) => !inAlerts.has(`content:${it.id}`)),
      },
      waitingCount: waiting.length,
    },
    waiting,
    upcoming: getUpcomingItems(snapshot.content, now, { tz }),
    upcomingTasks: buckets.upcoming,
    taskBuckets: buckets,
  };
}
