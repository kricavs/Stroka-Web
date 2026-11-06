// Dashboard data for the Studio, db-injected (pg, PGlite, tests).
// FOUR queries in total, whatever the number of clients (no per-client loops):
//   1. active clients  + month goal + month status counts + last activity
//   2. relevant content (+ latest change request, via LATERAL)
//   3. open tasks
//   4. recent activity
// Everything else is computed in rules.js.
import { APP_TIMEZONE, addDays, dayRange, monthKey, monthRange, ymd } from "../shared/time.js";
import { CONTENT_UPCOMING_DAYS } from "./config.js";
import { RELEVANT_EVENTS, humanizeActivity } from "./activity-text.js";
import { buildOperations } from "./rules.js";

const iso = (v) => (v ? new Date(v).toISOString() : null);

export async function loadSnapshot(db, { now = new Date(), clientId = null, tz = APP_TIMEZONE } = {}) {
  const month = monthKey(now, tz);
  const mr = monthRange(month, tz);
  const today = ymd(now, tz);
  const winStart = dayRange(today, tz).start;
  const winEnd = dayRange(addDays(today, CONTENT_UPCOMING_DAYS + 1), tz).start;

  const [clients, content, tasks, activity] = await Promise.all([
    db.query(
      `SELECT c.id, c.name, c.display_name,
              COALESCE(NULLIF(g.contracted, 0), NULLIF((c.settings->>'defaultMonthly')::int, 0)) AS goal,
              (SELECT COALESCE(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                 FROM (SELECT i.status, count(*)::int AS n FROM content_items i
                        WHERE i.client_id = c.id AND i.scheduled_at >= $2 AND i.scheduled_at < $3 GROUP BY i.status) s) AS month_counts,
              (SELECT max(a.created_at) FROM activity_log a WHERE a.client_id = c.id AND a.event <> 'login.success') AS last_activity
         FROM clients c LEFT JOIN client_month_goals g ON g.client_id = c.id AND g.month = $1
        WHERE c.active AND ($4::text IS NULL OR c.id = $4)
        ORDER BY lower(c.name)`,
      [month, mr.start, mr.end, clientId]
    ),
    db.query(
      `SELECT i.id, i.client_id, c.name AS client_name, i.title, i.platform, i.content_type, i.scheduled_at, i.status,
              i.sent_to_client_at, i.version, cr.actor_name AS cr_by, cr.created_at AS cr_at
         FROM content_items i JOIN clients c ON c.id = i.client_id
         LEFT JOIN LATERAL (SELECT a.actor_name, a.created_at FROM content_approvals a
                             WHERE a.content_id = i.id AND a.action = 'changes_requested'
                             ORDER BY a.created_at DESC LIMIT 1) cr ON i.status = 'changes_requested'
        WHERE c.active AND ($3::text IS NULL OR i.client_id = $3) AND i.status <> 'cancelled'
          AND (i.status NOT IN ('published','idea') OR (i.scheduled_at >= $1 AND i.scheduled_at < $2))
        ORDER BY i.scheduled_at NULLS LAST, i.created_at DESC LIMIT 1000`,
      [winStart, winEnd, clientId]
    ),
    db.query(
      `SELECT t.id, t.client_id, c.name AS client_name, t.content_id, i.title AS content_title, t.title, t.priority, t.status,
              t.kind, t.assignee, to_char(t.due_date,'YYYY-MM-DD') AS due
         FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN content_items i ON i.id = t.content_id
        WHERE t.status IN ('pending','in_progress') AND ($1::text IS NULL OR t.client_id = $1)
          AND (t.client_id IS NULL OR c.active)
        ORDER BY t.due_date NULLS LAST, t.created_at LIMIT 1000`,
      [clientId]
    ),
    db.query(
      `SELECT a.seq, a.client_id, c.name AS client_name, a.content_id, i.title AS content_title, a.actor_type, a.actor_name,
              a.event, a.data, a.created_at
         FROM activity_log a JOIN clients c ON c.id = a.client_id
         LEFT JOIN content_items i ON i.id = a.content_id AND i.client_id = a.client_id
        WHERE c.active AND a.event = ANY($1::text[]) AND ($2::text IS NULL OR a.client_id = $2)
        ORDER BY a.seq DESC LIMIT 60`,
      [RELEVANT_EVENTS, clientId]
    ),
  ]);

  return {
    clients: clients.map((c) => ({ id: c.id, name: c.name, goal: c.goal === null ? null : Number(c.goal), monthCounts: c.month_counts || {} })),
    lastActivity: Object.fromEntries(clients.filter((c) => c.last_activity).map((c) => [c.id, iso(c.last_activity)])),
    content: content.map((r) => ({
      id: r.id, clientId: r.client_id, clientName: r.client_name, title: r.title, platform: r.platform, contentType: r.content_type,
      scheduledAt: iso(r.scheduled_at), status: r.status, sentToClientAt: iso(r.sent_to_client_at), version: r.version,
      changeRequestedBy: r.cr_by || null, changeRequestedAt: iso(r.cr_at),
    })),
    tasks: tasks.map((t) => ({
      id: t.id, clientId: t.client_id, clientName: t.client_name, contentId: t.content_id, contentTitle: t.content_title,
      title: t.title, priority: t.priority, status: t.status, kind: t.kind, assignee: t.assignee, due: t.due,
    })),
    activityRows: activity,
  };
}

export async function getOperations(db, opts = {}) {
  const now = opts.now || new Date();
  const snap = await loadSnapshot(db, { ...opts, now });
  const ops = buildOperations(snap, now, opts.tz);
  return { ...ops, activity: humanizeActivity(snap.activityRows, now, { tz: opts.tz }) };
}

// ---- calendar extras ------------------------------------------------------

// Open tasks with a due date inside [fromDay, toDay] ('YYYY-MM-DD'), plus the undated ones.
export async function calendarTasks(db, { clientId, priority, fromDay, toDay, undated = false }) {
  return db.query(
    `SELECT t.id, t.client_id, c.name AS client_name, t.title, t.priority, t.status, t.assignee, to_char(t.due_date,'YYYY-MM-DD') AS due
       FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
      WHERE t.status IN ('pending','in_progress') AND (t.client_id IS NULL OR c.active)
        AND ($1::text IS NULL OR t.client_id = $1) AND ($2::text IS NULL OR t.priority = $2)
        AND ${undated ? "t.due_date IS NULL" : "t.due_date >= $3::date AND t.due_date <= $4::date"}
      ORDER BY t.due_date NULLS LAST, t.created_at LIMIT 300`,
    undated ? [clientId || null, priority || null] : [clientId || null, priority || null, fromDay, toDay]
  ).then((rows) => rows.map((t) => ({ id: t.id, clientId: t.client_id, clientName: t.client_name, title: t.title, priority: t.priority, status: t.status, assignee: t.assignee, due: t.due })));
}
