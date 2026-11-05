// Portal DTOs. The ONLY shape in which content leaves the server towards a
// client. Fields are whitelisted here (not "everything minus secrets"), so a
// column added to content_items later is invisible to clients until someone
// deliberately adds it below. Never exposed: internal_notes, assignee,
// version, sent_to_client_at, ids of other entities, activity.
import {
  CLIENT_STATUS_LABEL,
  PLATFORM_LABEL,
  SUMMARY_BUCKETS,
  TYPE_LABEL,
  isClientVisible,
  isMinimalForClient,
  progressPct,
} from "../shared/content.js";

const iso = (d) => (d ? new Date(d).toISOString() : null);

export function toPortalContent(row) {
  if (!row || !isClientVisible(row.status)) return null;
  const base = {
    id: row.id,
    title: row.title,
    scheduledAt: iso(row.scheduled_at),
    status: row.status,
    statusLabel: CLIENT_STATUS_LABEL[row.status],
  };
  // "En producción": title + planned date + status, nothing else.
  if (isMinimalForClient(row.status)) return { ...base, minimal: true };
  return {
    ...base,
    minimal: false,
    platform: row.platform,
    platformLabel: PLATFORM_LABEL[row.platform] || "Otro",
    contentType: row.content_type,
    typeLabel: TYPE_LABEL[row.content_type] || "Otro",
    copy: row.copy || "",
    clientNotes: row.client_notes || "",
    previewUrl: row.preview_url || null,
    publishedUrl: row.status === "published" ? row.published_url || null : null,
    publishedAt: iso(row.published_at),
    version: row.version,
    canRespond: row.status === "client_review",
  };
}

// Latest approval of the CURRENT version, only while the item is approved or
// later. Studio-recorded (WhatsApp) approvals are labelled as such.
export function toPortalApproval(row) {
  if (!row) return null;
  const external = row.action === "manual_approval";
  return {
    by: external ? row.metadata?.approverName || row.actor_name : row.actor_name,
    at: iso(row.created_at),
    version: row.content_version,
    external,
    channel: external ? row.metadata?.channel || null : null,
  };
}

export function toPortalComment(row) {
  return {
    id: row.id,
    authorType: row.author_type,
    authorName: row.author_name,
    body: row.body,
    createdAt: iso(row.created_at),
  };
}

// Client-visible tasks only. No priority/assignee/created_by.
export function toPortalTask(row, today) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    dueDate: row.due_date || null,
    overdue: Boolean(row.due_date && today && row.due_date < today),
    status: row.status,
    contentId: row.content_visible ? row.content_id : null,
    contentTitle: row.content_visible ? row.content_title : null,
  };
}

// Pendientes order: overdue first, then things that need an approval, then
// the nearest date. Items: { kind: 'approval'|'changes'|'task', overdue, when (ISO|YYYY-MM-DD|null) }.
const KIND_RANK = { approval: 0, task: 1, changes: 2 };
export function sortPending(items) {
  const t = (x) => (x.when ? new Date(x.when.length === 10 ? `${x.when}T12:00:00Z` : x.when).getTime() : Infinity);
  return [...items].sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || KIND_RANK[a.kind] - KIND_RANK[b.kind] || t(a) - t(b)
  );
}

export function toPortalProfile(row) {
  return {
    name: row.name,
    displayName: row.display_name,
    accent: /^#[0-9a-f]{6}$/i.test(row.accent || "") ? row.accent : null,
    defaultMonthly: Number.isInteger(row.settings?.defaultMonthly) ? row.settings.defaultMonthly : 0,
  };
}

// counts: { [status]: n } for the month (visible statuses only).
export function buildSummary(counts, contracted) {
  const sum = (list) => list.reduce((n, s) => n + (counts[s] || 0), 0);
  const published = sum(SUMMARY_BUCKETS.published);
  return {
    contracted,
    published,
    scheduled: sum(SUMMARY_BUCKETS.scheduled),
    review: sum(SUMMARY_BUCKETS.review),
    production: sum(SUMMARY_BUCKETS.production),
    progress: progressPct(published, contracted),
  };
}
