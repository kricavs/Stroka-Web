// Portal side of client files, parameterised on `scopedQuery` (see content-core.js).
//
// A file is visible to the client when ALL hold: it belongs to the client, is
// not archived, is flagged client_visible, and — if attached to a content item —
// that item is itself visible with detail (same rule as comments). Anything
// else is "not found", indistinguishable from a file of another client.
import { CLIENT_COMMENTABLE_STATUSES } from "../shared/content.js";
import { CATEGORY_LABEL, KIND_BY_MIME, PORTAL_CATEGORY_ORDER } from "../files/rules.js";
import { logActivity } from "./activity-core.js";
import { assertScope } from "./scope-core.js";

const VISIBLE_SQL = `f.client_id = $1 AND f.deleted_at IS NULL AND f.client_visible
  AND (f.content_id IS NULL OR i.status = ANY($2::text[]))`;
const FROM = `client_files f LEFT JOIN content_items i ON i.id = f.content_id AND i.client_id = f.client_id`;

// Whitelist: no blob_pathname, no uploader, no ids other than the file's own.
export function toPortalFile(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description || "",
    category: r.category,
    categoryLabel: CATEGORY_LABEL[r.category] || "Otros",
    kind: KIND_BY_MIME[r.mime] || "other",
    size: Number(r.size),
    version: r.version,
    groupKey: r.group_key,
    isFinal: Boolean(r.is_final),
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// → [{ category, label, groups: [{ key, latest, older: [...] }] }] in portal order.
export function groupFiles(files) {
  const byCat = new Map();
  for (const f of files) {
    if (!byCat.has(f.category)) byCat.set(f.category, new Map());
    const groups = byCat.get(f.category);
    if (!groups.has(f.groupKey)) groups.set(f.groupKey, []);
    groups.get(f.groupKey).push(f);
  }
  return PORTAL_CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    groups: [...byCat.get(category).entries()]
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => b.version - a.version);
        return { key, latest: sorted[0], older: sorted.slice(1) };
      })
      .sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt)),
  }));
}

export function shouldLogDownload(f) {
  return f.category === "deliverables" || f.category === "documents" || Boolean(f.is_final ?? f.isFinal);
}

export function filesRepo(scopedQuery) {
  const COLS = `f.id, f.category, f.name, f.description, f.mime, f.size, f.version, f.group_key, f.is_final, f.created_at`;

  async function listFiles(scope) {
    const rows = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM ${FROM} WHERE ${VISIBLE_SQL} ORDER BY f.created_at DESC LIMIT 300`,
      [CLIENT_COMMENTABLE_STATUSES]
    );
    return rows.map(toPortalFile);
  }

  async function listForContent(scope, contentId) {
    if (typeof contentId !== "string" || contentId.length > 64) return [];
    const rows = await scopedQuery(
      scope,
      `SELECT ${COLS} FROM ${FROM} WHERE ${VISIBLE_SQL} AND f.content_id = $3 ORDER BY f.created_at DESC LIMIT 50`,
      [CLIENT_COMMENTABLE_STATUSES, contentId]
    );
    return rows.map(toPortalFile);
  }

  // Server-side only (has the blob pathname). null = 404.
  async function getForDownload(scope, id) {
    if (typeof id !== "string" || id.length > 64) return null;
    const [r] = await scopedQuery(
      scope,
      `SELECT ${COLS}, f.blob_pathname FROM ${FROM} WHERE ${VISIBLE_SQL} AND f.id = $3`,
      [CLIENT_COMMENTABLE_STATUSES, id]
    );
    return r || null;
  }

  async function deliverableCount(scope) {
    const [r] = await scopedQuery(
      scope,
      `SELECT count(DISTINCT f.group_key)::int AS n FROM ${FROM} WHERE ${VISIBLE_SQL} AND f.category = 'deliverables'`,
      [CLIENT_COMMENTABLE_STATUSES]
    );
    return r.n;
  }

  return { listFiles, listForContent, getForDownload, deliverableCount };
}

// Logs a client download when it is worth knowing about (deliverables,
// documents, final files). Never for previews, never for admin-preview.
// `db` is any { query }. No URL, no pathname: only file, version, name, actor.
export async function recordDownload(db, scope, file) {
  assertScope(scope);
  if (scope.source !== "session" || !shouldLogDownload(file)) return false;
  await logActivity(db, {
    clientId: scope.clientId,
    actorType: "client",
    actorName: scope.displayName || "Cliente",
    event: "file.downloaded",
    data: { fileId: file.id, name: file.name, version: file.version, final: Boolean(file.is_final), category: file.category },
    clientVisible: false,
  });
  return true;
}
