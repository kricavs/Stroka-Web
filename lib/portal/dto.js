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
  };
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
