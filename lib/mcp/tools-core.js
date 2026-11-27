// MCP tool implementations, db-injected. Each tool is `(db, scope, input, opts)`.
//
// - The client ALWAYS comes from the McpScope (the authenticated token). Input
//   never carries a client id; the schemas in ./schemas.js reject it.
// - There is NO SQL for business rules here: writes go through the same
//   content-core / tasks-core services Studio uses (transitions, versions,
//   approval invalidation, activity log, timezone). MCP is another interface,
//   not another backend.
// - Foreign / unknown ids are NOT_FOUND (never "forbidden").
import { logActivity } from "../portal/activity-core.js";
import { InputError, VersionConflictError } from "../studio/errors.js";
import {
  changeStatusTx, createContentTx, getContent as getContentRow, listContent, updateContentTx,
} from "../studio/content-core.js";
import { createTaskTx, getTask as getTaskRow, listTasks, setTaskStatusTx, updateTaskTx } from "../studio/tasks-core.js";
import { getOperations } from "../operations/queries-core.js";
import { APP_TIMEZONE, monthKey, monthRange, toLocalInput, zonedParts } from "../shared/time.js";
import { McpError } from "./errors.js";
import { assertMcpScope } from "./scope-core.js";

// Statuses Claude may move content to. Anything that reaches the client
// (client_review), records a client decision (approved), or publishes
// (scheduled/published) stays a human action in Studio.
export const MCP_STATUS_TARGETS = ["idea", "production", "review", "cancelled"];
export const MCP_CREATE_STATUSES = ["idea", "production"];

const pad = (n) => String(n).padStart(2, "0");
const actorOf = (scope) => ({ actorType: "admin", actorName: /^claude\b/i.test(scope.label) ? scope.label : `Claude · ${scope.label}` });

// Studio services throw InputError(status); translate to the MCP contract.
export function toMcpError(err) {
  if (err instanceof McpError) return err;
  if (err instanceof VersionConflictError) {
    return new McpError("CONFLICT", err.message, { expected_version: err.expectedVersion, current_version: err.currentVersion });
  }
  if (err instanceof InputError) {
    if (err.status === 404) return new McpError("NOT_FOUND", err.message);
    if (err.status === 409) return new McpError("INVALID_TRANSITION", err.message);
    return new McpError("INVALID_INPUT", err.message);
  }
  return null; // unexpected: the caller logs it and answers a generic error
}

function requireWrite(scope) {
  if (!scope.canWrite) throw new McpError("READ_ONLY", "Este acceso es de solo lectura.");
}

const contentDto = (c) => {
  const d = c.scheduledAt ? new Date(c.scheduledAt) : null;
  const p = d ? zonedParts(d, APP_TIMEZONE) : null;
  return {
    id: c.id,
    version: c.version,
    date: p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : null,
    time: p ? `${pad(p.hour)}:${pad(p.minute)}` : null,
    scheduled_at: d ? toLocalInput(d, APP_TIMEZONE) : null,
    title: c.title,
    type: c.contentType,
    platform: c.platform,
    status: c.status,
    pillar: c.pillar || null,
    cta: c.cta || null,
  };
};

const audit = (t, scope, tool, event, contentId, data) =>
  logActivity(t, {
    clientId: scope.clientId, contentId, ...actorOf(scope), event,
    data: { via: "mcp", tool, tokenId: scope.tokenId, tokenLabel: scope.label, ...data },
  });

// ---- READ -----------------------------------------------------------------

export async function getClient(db, scope, _input, { now = new Date() } = {}) {
  assertMcpScope(scope);
  const month = monthKey(now);
  const [c] = await db.query(
    `SELECT c.name, c.display_name, c.active,
            COALESCE(NULLIF(g.contracted, 0), NULLIF((c.settings->>'defaultMonthly')::int, 0)) AS goal
       FROM clients c LEFT JOIN client_month_goals g ON g.client_id = c.id AND g.month = $2
      WHERE c.id = $1`,
    [scope.clientId, month]
  );
  if (!c) throw new McpError("NOT_FOUND", "Cliente no encontrado.");
  return {
    name: c.name, display_name: c.display_name, active: c.active,
    monthly_goal: c.goal === null ? null : Number(c.goal), goal_month: month, timezone: APP_TIMEZONE,
    permissions: scope.canWrite ? "read_write" : "read_only",
  };
}

export async function getCalendar(db, scope, { month }) {
  assertMcpScope(scope);
  const rows = await listContent(db, { clientId: scope.clientId, range: monthRange(month), limit: 500 });
  return { month, timezone: APP_TIMEZONE, count: rows.length, items: rows.map(contentDto) };
}

export async function getContent(db, scope, { content_id }) {
  assertMcpScope(scope);
  const c = await getContentRow(db, content_id);
  if (!c || c.clientId !== scope.clientId) throw new McpError("NOT_FOUND", "Contenido no encontrado.");
  return { ...contentDto(c), copy: c.copy || null, client_notes: c.clientNotes || null };
}

export async function getPending(db, scope, _input, { now = new Date() } = {}) {
  assertMcpScope(scope);
  const [ops, tasks, changes] = await Promise.all([
    getOperations(db, { now, clientId: scope.clientId }),
    listTasks(db, { clientId: scope.clientId, status: "open", limit: 100 }),
    listContent(db, { clientId: scope.clientId, status: "changes_requested", limit: 100 }),
  ]);
  return {
    open_tasks: tasks.map((t) => ({
      id: t.id, title: t.title, due_date: t.due, priority: t.priority, status: t.status, visibility: t.visibility,
      content_id: t.content_id, kind: t.kind,
    })),
    client_review: ops.waiting.map((w) => ({ ...contentDto(w), days_waiting: w.daysWaiting, stale: w.stale })),
    changes_requested: changes.map(contentDto),
    upcoming: ops.upcoming.map((u) => ({ ...contentDto(u), risk: u.risk?.label ?? null })),
  };
}

// ---- WRITE ----------------------------------------------------------------

export async function createContent(db, scope, input) {
  assertMcpScope(scope);
  requireWrite(scope);
  return db.tx(async (t) => {
    const id = await createContentTx(t, scope.clientId, {
      title: input.title, platform: input.platform, contentType: input.type, scheduledLocal: input.scheduled_at,
      pillar: input.pillar, cta: input.cta, copy: input.copy, clientNotes: input.client_notes, status: input.status ?? "production",
    }, { actor: actorOf(scope) });
    await audit(t, scope, "create_content", "mcp.content_created", id, { status: input.status ?? "production" });
    return contentDto(await getContentRow(t, id));
  });
}

const PATCH_FIELDS = { title: "title", scheduled_at: "scheduledLocal", type: "contentType", platform: "platform", pillar: "pillar", cta: "cta", copy: "copy", client_notes: "clientNotes" };

export async function updateContent(db, scope, { content_id, expected_version, patch }) {
  assertMcpScope(scope);
  requireWrite(scope);
  return db.tx(async (t) => {
    // Lock the row (scoped to the token's client) and check the version first.
    const [cur] = await t.query(
      `SELECT status, version FROM content_items WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [content_id, scope.clientId]
    );
    if (!cur) throw new McpError("NOT_FOUND", "Contenido no encontrado.");
    if (cur.version !== expected_version) throw new VersionConflictError(expected_version, cur.version);

    const input = {};
    for (const [k, v] of Object.entries(patch)) if (PATCH_FIELDS[k]) input[PATCH_FIELDS[k]] = v === null ? "" : v;
    if (patch.scheduled_at === null) input.scheduledLocal = "";
    const opts = { actor: actorOf(scope), clientId: scope.clientId };
    let changed = [];
    let toVersion = cur.version;
    let invalidated = false;
    if (Object.keys(input).length) {
      const r = await updateContentTx(t, content_id, input, { ...opts, expectedVersion: expected_version });
      changed = r.changed;
      toVersion = r.toVersion;
      invalidated = Boolean(r.invalidated);
    }
    let statusChange = null;
    if (patch.status !== undefined) {
      const [now] = await t.query(`SELECT status FROM content_items WHERE id = $1`, [content_id]);
      if (now.status !== patch.status) {
        const r = await changeStatusTx(t, content_id, patch.status, opts);
        statusChange = { from: r.from, to: r.to };
        toVersion = r.toVersion;
        changed = [...changed, "status"];
      }
    }
    if (changed.length) {
      await audit(t, scope, "update_content", "mcp.content_updated", content_id, {
        fields: changed, fromVersion: cur.version, toVersion, ...(statusChange ? { statusFrom: statusChange.from, statusTo: statusChange.to } : {}),
        ...(invalidated ? { approvalInvalidated: true } : {}),
      });
    }
    return {
      changed_fields: changed,
      previous_version: cur.version,
      approval_invalidated: invalidated,
      content: { ...contentDto(await getContentRow(t, content_id)) },
    };
  });
}

const taskDto = (t) => ({
  id: t.id, title: t.title, description: t.description ?? null, due_date: t.due ?? null, priority: t.priority,
  status: t.status, visibility: t.visibility, content_id: t.content_id ?? null,
});

export async function createTask(db, scope, input) {
  assertMcpScope(scope);
  requireWrite(scope);
  return db.tx(async (t) => {
    if (input.content_id) {
      const [c] = await t.query(`SELECT 1 FROM content_items WHERE id = $1 AND client_id = $2 AND deleted_at IS NULL`, [input.content_id, scope.clientId]);
      if (!c) throw new McpError("NOT_FOUND", "Contenido no encontrado.");
    }
    const { id } = await createTaskTx(t, {
      title: input.title, description: input.description, dueDate: input.due_date, priority: input.priority ?? "normal",
      visibility: input.visibility ?? "internal", clientId: scope.clientId, contentId: input.content_id,
    }, { actor: actorOf(scope) });
    await audit(t, scope, "create_task", "mcp.task_created", input.content_id ?? null, { taskId: id });
    return taskDto(await getTaskRow(t, id));
  });
}

export async function updateTask(db, scope, { task_id, patch }) {
  assertMcpScope(scope);
  requireWrite(scope);
  return db.tx(async (t) => {
    const opts = { actor: actorOf(scope), clientId: scope.clientId };
    const [own] = await t.query(`SELECT content_id FROM tasks WHERE id = $1 AND client_id = $2 FOR UPDATE`, [task_id, scope.clientId]);
    if (!own) throw new McpError("NOT_FOUND", "Tarea no encontrada.");
    const input = {};
    if (patch.title !== undefined) input.title = patch.title;
    if (patch.description !== undefined) input.description = patch.description ?? "";
    if (patch.due_date !== undefined) input.dueDate = patch.due_date ?? "";
    if (patch.priority !== undefined) input.priority = patch.priority;
    const fields = Object.keys(input).map((k) => (k === "dueDate" ? "due_date" : k));
    if (Object.keys(input).length) await updateTaskTx(t, task_id, input, opts);
    let statusChange = null;
    if (patch.status !== undefined) {
      const r = await setTaskStatusTx(t, task_id, patch.status, opts);
      if (r.from !== patch.status) { statusChange = { from: r.from, to: patch.status }; fields.push("status"); }
    }
    if (fields.length) {
      await audit(t, scope, "update_task", "mcp.task_updated", own.content_id ?? null, {
        taskId: task_id, fields, ...(statusChange ? { statusFrom: statusChange.from, statusTo: statusChange.to } : {}),
      });
    }
    return { changed_fields: fields, task: taskDto(await getTaskRow(t, task_id)) };
  });
}
