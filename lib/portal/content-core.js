import { CLIENT_COMMENTABLE_STATUSES, CLIENT_VISIBLE_STATUSES, OPEN_TASK_STATUSES } from "../shared/content.js";
import { APP_TIMEZONE, monthRange, ymd } from "../shared/time.js";
import { buildSummary, sortPending, toPortalApproval, toPortalComment, toPortalContent, toPortalProfile, toPortalTask } from "./dto.js";

// Portal read repository, parameterised on `scopedQuery(scope, sql, params, opts)`
// (lib/portal/server/content.js wires the real one; tests wire an in-memory db).
// Every query goes through it (client id comes
// from the scope as $1, never from the request) and only visible statuses.
// Rows are turned into DTOs before they leave this module.

const COLS = `id, title, platform, content_type, scheduled_at, status, copy, client_notes,
              preview_url, published_url, published_at, version`;
const VISIBLE = CLIENT_VISIBLE_STATUSES;
const COLUMN_NAMES = new Set(["id", "title", "platform", "content_type", "scheduled_at", "status", "copy", "client_notes", "preview_url", "published_url", "published_at", "version"]);

export function contentRepo(scopedQuery) {

  async function getProfile(scope) {
    const [row] = await scopedQuery(
      scope,
      `SELECT name, display_name, accent, settings FROM clients WHERE id = $1`,
      [],
      { self: true }
    );
    return row ? toPortalProfile(row) : null;
  }

  async function listVisible(scope, { start, end }) {
    const rows = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM content_items
        WHERE client_id = $1 AND status = ANY($2::text[]) AND scheduled_at >= $3 AND scheduled_at < $4
        ORDER BY scheduled_at, created_at`,
      [VISIBLE, start, end]
    );
    return rows.map(toPortalContent);
  }

  async function listUndated(scope) {
    const rows = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM content_items
        WHERE client_id = $1 AND status = ANY($2::text[]) AND scheduled_at IS NULL
        ORDER BY created_at DESC LIMIT 100`,
      [VISIBLE]
    );
    return rows.map(toPortalContent);
  }

  // Same answer (null → 404) for "doesn't exist", "belongs to another client"
  // and "not visible yet": nothing to tell them apart.
  async function getVisible(scope, id) {
    if (typeof id !== "string" || id.length > 64) return null;
    const [row] = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM content_items WHERE client_id = $1 AND id = $2 AND status = ANY($3::text[])`,
      [id, VISIBLE]
    );
    return row ? toPortalContent(row) : null;
  }

  async function nextPublication(scope, now = new Date()) {
    const [row] = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM content_items
        WHERE client_id = $1 AND status = ANY($2::text[]) AND status <> 'published' AND scheduled_at >= $3
        ORDER BY scheduled_at LIMIT 1`,
      [VISIBLE, now]
    );
    return row ? toPortalContent(row) : null;
  }

  async function monthSummary(scope, month, defaultMonthly = 0, tz = APP_TIMEZONE) {
    const { start, end } = monthRange(month, tz);
    const rows = await scopedQuery(
      scope,
      `SELECT status, count(*)::int AS n FROM content_items
        WHERE client_id = $1 AND status = ANY($2::text[]) AND scheduled_at >= $3 AND scheduled_at < $4
        GROUP BY status`,
      [VISIBLE, start, end]
    );
    const [goal] = await scopedQuery(
      scope,
      `SELECT contracted FROM client_month_goals WHERE client_id = $1 AND month = $2`,
      [month]
    );
    const counts = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    return buildSummary(counts, goal ? goal.contracted : defaultMonthly);
  }

  // Approval that applies to the version on screen (null if none / superseded).
  async function currentApproval(scope, contentId, version) {
    const [row] = await scopedQuery(
      scope,
      `SELECT action, actor_name, content_version, metadata, created_at FROM content_approvals
        WHERE client_id = $1 AND content_id = $2 AND content_version = $3 AND action IN ('approved','manual_approval')
        ORDER BY created_at DESC LIMIT 1`,
      [contentId, version]
    );
    return toPortalApproval(row);
  }

  async function listComments(scope, contentId) {
    if (typeof contentId !== "string" || contentId.length > 64) return [];
    const rows = await scopedQuery(
      scope,
      `SELECT cm.id, cm.author_type, cm.author_name, cm.body, cm.created_at
         FROM content_comments cm JOIN content_items i ON i.id = cm.content_id AND i.client_id = cm.client_id
        WHERE cm.client_id = $1 AND cm.content_id = $2 AND i.status = ANY($3::text[])
        ORDER BY cm.created_at, cm.id LIMIT 200`,
      [contentId, CLIENT_COMMENTABLE_STATUSES]
    );
    return rows.map(toPortalComment);
  }

  // Only what needs an ACTION from the client, already ordered: content in
  // client_review and open client-visible tasks. changes_requested is Stroka's
  // turn, so it is not a pending. A content item that already has an open
  // client-visible task shows up as that task, not twice.
  const NO_OPEN_CLIENT_TASK = `NOT EXISTS (SELECT 1 FROM tasks k WHERE k.client_id = c.client_id AND k.content_id = c.id
                                AND k.visibility = 'client' AND k.status = ANY($2::text[]))`;

  async function listPending(scope, now = new Date(), tz = APP_TIMEZONE) {
    const today = ymd(now, tz);
    const contents = await scopedQuery(
      scope,
      `SELECT ${COLS.replace(/\b(\w+)\b/g, (m) => (COLUMN_NAMES.has(m) ? `c.${m}` : m))}
         FROM content_items c WHERE c.client_id = $1 AND c.status = 'client_review' AND ${NO_OPEN_CLIENT_TASK}
        ORDER BY c.scheduled_at NULLS LAST LIMIT 100`,
      [OPEN_TASK_STATUSES]
    );
    const tasks = await scopedQuery(
      scope,
      `SELECT t.id, t.title, t.description, to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.status, t.content_id,
              (i.id IS NOT NULL AND i.status = ANY($3::text[])) AS content_visible, i.title AS content_title
         FROM tasks t LEFT JOIN content_items i ON i.id = t.content_id AND i.client_id = t.client_id
        WHERE t.client_id = $1 AND t.visibility = 'client' AND t.status = ANY($2::text[])
        ORDER BY t.due_date NULLS LAST, t.created_at LIMIT 100`,
      [OPEN_TASK_STATUSES, CLIENT_VISIBLE_STATUSES]
    );
    const items = [
      ...contents.map((r) => {
        const dto = toPortalContent(r);
        return {
          kind: "approval",
          overdue: Boolean(r.scheduled_at && new Date(r.scheduled_at) < now),
          when: dto.scheduledAt,
          content: dto,
        };
      }),
      ...tasks.map((r) => {
        const task = toPortalTask(r, today);
        return { kind: "task", overdue: task.overdue, when: task.dueDate, task };
      }),
    ];
    return sortPending(items);
  }

  async function pendingCounts(scope) {
    const [c] = await scopedQuery(
      scope,
      `SELECT (SELECT count(*) FROM content_items c WHERE c.client_id = $1 AND c.status = 'client_review' AND ${NO_OPEN_CLIENT_TASK})::int AS review,
              (SELECT count(*) FROM tasks WHERE client_id = $1 AND visibility = 'client' AND status = ANY($2::text[]))::int AS tasks`,
      [OPEN_TASK_STATUSES]
    );
    return c;
  }

  return { currentApproval, listComments, listPending, pendingCounts, getProfile, listVisible, listUndated, getVisible, nextPublication, monthSummary };
}
