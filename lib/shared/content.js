// Content workflow shared by Studio and Portal. Pure: no framework imports.

export const PLATFORMS = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["web", "Web"],
  ["other", "Otro"],
];
export const CONTENT_TYPES = [
  ["reel", "Reel"],
  ["post", "Post"],
  ["carousel", "Carrusel"],
  ["story", "Historia"],
  ["video", "Video"],
  ["short", "Short"],
  ["article", "Artículo"],
  ["other", "Otro"],
];
export const PLATFORM_LABEL = Object.fromEntries(PLATFORMS);
export const TYPE_LABEL = Object.fromEntries(CONTENT_TYPES);

export const STATUSES = [
  "idea",
  "production",
  "review",
  "client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "cancelled",
];

// Studio wording.
export const STATUS_LABEL = {
  idea: "Idea",
  production: "En producción",
  review: "Revisión interna",
  client_review: "En revisión del cliente",
  changes_requested: "Cambios solicitados",
  approved: "Aprobado",
  scheduled: "Programado",
  published: "Publicado",
  cancelled: "Cancelado",
};

// Allowed moves. Fase 1: only Studio moves content. The client-driven edges
// (client_review → approved / changes_requested) exist in the graph so Fase 2
// can reuse it; Studio may use them too (e.g. approval received by WhatsApp).
export const TRANSITIONS = {
  idea: ["production", "cancelled"],
  production: ["idea", "review", "cancelled"],
  review: ["production", "client_review", "cancelled"],
  client_review: ["review", "approved", "changes_requested", "production", "cancelled"],
  changes_requested: ["production", "cancelled"],
  approved: ["scheduled", "published", "production", "cancelled"],
  scheduled: ["published", "approved", "production", "cancelled"],
  published: [],
  cancelled: ["idea"],
};

export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

// What the CLIENT may see. Anything not listed is invisible (idea, review,
// cancelled). `production` is visible only as title + date + status.
export const CLIENT_VISIBLE_STATUSES = [
  "production",
  "client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
];
export const isClientVisible = (status) => CLIENT_VISIBLE_STATUSES.includes(status);
export const isMinimalForClient = (status) => status === "production";

// Client wording (shorter, no internal process).
export const CLIENT_STATUS_LABEL = {
  production: "En producción",
  client_review: "Para tu revisión",
  changes_requested: "Cambios en curso",
  approved: "Aprobado",
  scheduled: "Programado",
  published: "Publicado",
};

// Progress buckets for the client's monthly summary.
export const SUMMARY_BUCKETS = {
  published: ["published"],
  scheduled: ["approved", "scheduled"],
  review: ["client_review", "changes_requested"],
  production: ["production"],
};

export const progressPct = (published, contracted) =>
  contracted > 0 ? Math.min(100, Math.round((published / contracted) * 100)) : null;

export const isHttpUrl = (s) => {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export const EVENT_LABEL = {
  "client.created": "Cliente creado",
  "client.activated": "Cliente activado",
  "client.deactivated": "Cliente desactivado",
  "client.updated": "Datos del cliente actualizados",
  "access.generated": "Acceso generado",
  "access.regenerated": "Acceso regenerado",
  "client.access_unlocked": "Acceso desbloqueado",
  "sessions.revoked": "Sesiones cerradas",
  "login.success": "Ingreso al portal",
  "goal.set": "Meta mensual actualizada",
  "content.created": "Contenido creado",
  "content.updated": "Contenido actualizado",
  "content.status_changed": "Cambio de estado",
  "content.rescheduled": "Cambio de fecha",
  "content.published": "Contenido publicado",
};

// Dot colour per status (calendar chips), shared by Studio and Portal.
export const STATUS_COLOR = {
  idea: "#6b6b70",
  production: "#d9a441",
  review: "#a78bd4",
  client_review: "#5b9bff",
  changes_requested: "#e07a5f",
  approved: "#6fbf8e",
  scheduled: "#4fb3c8",
  published: "#3fa66a",
  cancelled: "#8a4a4a",
};

// ---- Fase 2 ---------------------------------------------------------------

// Moves Studio may make by hand. client_review → approved / changes_requested
// are NOT here: they are recorded as a client decision (portal) or as an
// external approval (Studio "registrar aprobación externa"), never as a bare
// status flip, so every approval leaves a row in content_approvals.
export const STUDIO_TRANSITIONS = Object.fromEntries(
  Object.entries(TRANSITIONS).map(([from, tos]) => [
    from,
    from === "client_review" ? tos.filter((t) => t !== "approved" && t !== "changes_requested") : tos,
  ])
);
export const canStudioTransition = (from, to) => (STUDIO_TRANSITIONS[from] || []).includes(to);

// Statuses in which the client may talk about a content item (detail visible).
export const CLIENT_COMMENTABLE_STATUSES = CLIENT_VISIBLE_STATUSES.filter((s) => s !== "production");

export const TASK_PRIORITIES = [["low", "Baja"], ["normal", "Normal"], ["high", "Alta"], ["urgent", "Urgente"]];
export const TASK_STATUSES = [["pending", "Pendiente"], ["in_progress", "En curso"], ["completed", "Completada"], ["cancelled", "Cancelada"]];
export const TASK_VISIBILITIES = [["internal", "Interna"], ["client", "Visible para el cliente"]];
export const TASK_PRIORITY_LABEL = Object.fromEntries(TASK_PRIORITIES);
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_STATUSES);
export const OPEN_TASK_STATUSES = ["pending", "in_progress"];

Object.assign(EVENT_LABEL, {
  "content.sent_for_review": "Enviado a revisión del cliente",
  "content.approved": "Aprobado por el cliente",
  "content.changes_requested": "Cambios solicitados por el cliente",
  "content.manual_approval": "Aprobación externa registrada",
  "content.approval_invalidated": "Aprobación invalidada por cambios",
  "content.comment_added": "Comentario",
  "task.created": "Tarea creada",
  "task.updated": "Tarea actualizada",
  "task.completed": "Tarea completada",
  "task.cancelled": "Tarea cancelada",
});

// Declared (not verified) person name: what the client types for their session.
export function cleanPersonName(input) {
  const s = String(input ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 80 ? s : null;
}
// Plain-text bodies: no HTML is ever rendered (React escapes), control chars dropped.
export function cleanText(input, max) {
  const s = String(input ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n/g, "\n").trim();
  return s.length >= 1 && s.length <= max ? s : null;
}
