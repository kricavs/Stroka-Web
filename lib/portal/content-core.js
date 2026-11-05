import { CLIENT_VISIBLE_STATUSES } from "../shared/content.js";
import { APP_TIMEZONE, monthRange } from "../shared/time.js";
import { buildSummary, toPortalContent, toPortalProfile } from "./dto.js";

// Portal read repository, parameterised on `scopedQuery(scope, sql, params, opts)`
// (lib/portal/server/content.js wires the real one; tests wire an in-memory db).
// Every query goes through it (client id comes
// from the scope as $1, never from the request) and only visible statuses.
// Rows are turned into DTOs before they leave this module.

const COLS = `id, title, platform, content_type, scheduled_at, status, copy, client_notes,
              preview_url, published_url, published_at`;
const VISIBLE = CLIENT_VISIBLE_STATUSES;

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

  return { getProfile, listVisible, listUndated, getVisible, nextPublication, monthSummary };
}
