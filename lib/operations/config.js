// Operational thresholds for the Studio dashboard. One place, no UI (yet).
// Every rule in rules.js reads from here; nothing else hardcodes these numbers.

// A content item waiting in `client_review` longer than this is "estancado".
export const CLIENT_REVIEW_STALE_DAYS = 3;
// A task due within this many days (after today) is "vence pronto".
export const TASK_DUE_SOON_DAYS = 2;
// "Próximos" window for publications and tasks (days after today).
export const CONTENT_UPCOMING_DAYS = 7;
export const TASK_UPCOMING_DAYS = 7;
// Publication at risk: dated within this many hours (or already past) and not
// approved/scheduled/published.
export const PUBLICATION_RISK_HOURS = 48;

// Monthly pace. expected = goal * (dayOfMonth / daysInMonth).
// - Not evaluated during the first PACE_GRACE_DAYS days of the month.
// - tolerance = max(PACE_TOLERANCE_MIN, goal * PACE_TOLERANCE_RATIO)
// - deficit = expected - planned
//     deficit <= tolerance      → ok (ahead when planned >= expected + tolerance)
//     deficit <= 2 * tolerance  → low    ("Ritmo bajo")
//     deficit  > 2 * tolerance  → behind ("Atrasado")
export const PACE_GRACE_DAYS = 5;
export const PACE_TOLERANCE_RATIO = 0.15;
export const PACE_TOLERANCE_MIN = 1;

// An `idea` is not a commitment: it does not count as "planned" for the goal.
export const PLANNED_INCLUDES_IDEAS = false;

// A client with no relevant activity for this long gets an `info` hint.
export const CLIENT_INACTIVITY_DAYS = 14;

// Dashboard sizes.
export const ACTIVITY_LIMIT = 12;
export const ALERTS_LIMIT = 30;

// Statuses in which a dated item must already be approved to be safe.
export const SAFE_STATUSES = ["approved", "scheduled", "published"];
// Statuses that must have a date (an `idea` may stay undated).
export const NEEDS_DATE_STATUSES = ["production", "review", "client_review", "changes_requested", "approved", "scheduled"];

export const LEVELS = ["info", "attention", "warning", "critical"];
export const LEVEL_RANK = { info: 0, attention: 1, warning: 2, critical: 3 };
export const LEVEL_LABEL = { info: "Info", attention: "Atención", warning: "Aviso", critical: "Crítico" };

// Operational state of a client (NOT access locking: see clients.locked_until).
export const OPERATIONAL_LABEL = { ok: "Al día", attention: "Atención", late: "Atrasado", blocked: "Bloqueado" };
