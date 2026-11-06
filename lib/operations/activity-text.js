// Turns raw activity_log rows into short human sentences for the dashboard.
// Technical event names are never shown. Pure.
import { APP_TIMEZONE, dayRange, formatDayShort, ymd, zonedParts } from "../shared/time.js";
import { ACTIVITY_LIMIT } from "./config.js";

// Only these events are "news". Logins, access, client edits and the owner's own
// routine (creating content or tasks) are noise here.
export const RELEVANT_EVENTS = [
  "content.sent_for_review", "content.approved", "content.changes_requested", "content.manual_approval",
  "content.approval_invalidated", "content.published", "content.comment_added",
  "task.completed", "task.cancelled",
  "file.uploaded", "file.version_added", "file.marked_final", "file.downloaded", "file.archived",
];

const q = (s) => (s ? `“${s}”` : "un contenido");
const actorOf = (r) => (r.actor_type === "client" ? r.actor_name || "El cliente" : r.actor_name || "Stroka");

const TEXT = {
  "content.sent_for_review": (r) => `Se envió ${q(r.content_title)} a revisión del cliente`,
  "content.approved": (r) => `${actorOf(r)} aprobó ${q(r.content_title)}`,
  "content.changes_requested": (r) => `${actorOf(r)} pidió cambios en ${q(r.content_title)}`,
  "content.manual_approval": (r) => `Aprobación externa registrada: ${q(r.content_title)}`,
  "content.approval_invalidated": (r) => `Se reabrió la aprobación de ${q(r.content_title)}`,
  "content.published": (r) => `${q(r.content_title)} quedó publicado`,
  "content.comment_added": (r) => `${actorOf(r)} comentó en ${q(r.content_title)}`,
  "task.completed": (r) => `${r.actor_type === "client" ? actorOf(r) : "Stroka"} completó la tarea${r.data?.title ? ` ${q(r.data.title)}` : ""}`,
  "task.cancelled": (r) => `Tarea cancelada: ${r.data?.title || "sin título"}`,
  "file.uploaded": (r) => `Stroka subió ${q(r.data?.name)}`,
  "file.version_added": (r) => `Stroka subió la versión ${r.data?.version ?? ""} de ${q(r.data?.name)}`.replace("  ", " "),
  "file.marked_final": (r) => `${q(r.data?.name)} quedó como entrega final`,
  "file.downloaded": (r) => `${actorOf(r)} descargó ${q(r.data?.name)}`,
  "file.archived": (r) => `Stroka archivó ${q(r.data?.name)}`,
};

export function humanizeActivity(rows, now, { limit = ACTIVITY_LIMIT, tz = APP_TIMEZONE } = {}) {
  // A client change request also logs a comment and an automatic task: keep one line.
  const changeReq = rows.filter((r) => r.event === "content.changes_requested");
  const closeTo = (a, b) => Math.abs(new Date(a.created_at) - new Date(b.created_at)) < 15000;
  const out = [];
  for (const r of rows) {
    const fn = TEXT[r.event];
    if (!fn) continue;
    if (r.event === "content.comment_added" && changeReq.some((c) => c.content_id === r.content_id && closeTo(c, r))) continue;
    out.push({
      seq: r.seq,
      text: fn(r),
      clientName: r.client_name,
      when: activityWhen(r.created_at, now, tz),
      at: new Date(r.created_at).toISOString(),
      href: r.event.startsWith("task.") && r.data?.taskId ? `/studio/tareas/${r.data.taskId}` : r.content_id ? `/studio/contenido/${r.content_id}` : `/studio/clientes/${r.client_id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// "10:32" today · "Ayer" · "08 NOV"
export function activityWhen(iso, now, tz = APP_TIMEZONE) {
  const d = new Date(iso);
  const today = ymd(now, tz);
  const day = ymd(d, tz);
  if (day === today) {
    const p = zonedParts(d, tz);
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  }
  const yesterday = ymd(new Date(dayRange(today, tz).start.getTime() - 3600_000), tz);
  if (yesterday === day) return "Ayer";
  return formatDayShort(d, tz);
}
