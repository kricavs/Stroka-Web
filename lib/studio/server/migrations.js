// Versioned, append-only migrations. Rules:
//  - Never edit or reorder an existing entry; add a new one with the next id.
//  - Additive only (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
//    No DROP, no destructive ALTER, no data rewrites.
//  - `statements` is an array so no SQL splitting is ever needed (the baseline
//    keeps the historical split for byte-for-byte compatibility).
//
// Pure module (no server-only / no driver) so it can be tested with node --test.

// Migration 1 = the schema that already runs in Production, verbatim.
const BASELINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS studio_budgets (
  id           TEXT PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  project_name TEXT NOT NULL,
  budget_date  DATE NOT NULL,
  currency     TEXT NOT NULL,
  total        NUMERIC(18,2) NOT NULL DEFAULT 0,
  data         JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS studio_counters (
  year INT PRIMARY KEY,
  last INT NOT NULL
);
CREATE TABLE IF NOT EXISTS site_images (
  id            TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  blob_pathname TEXT,
  width         INT,
  height        INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_home_slots (
  id           TEXT PRIMARY KEY,
  slot         TEXT NOT NULL CHECK (slot IN ('hero','contact','work')),
  project_slug TEXT,
  image_id     TEXT REFERENCES site_images(id),
  sort_order   INT NOT NULL DEFAULT 0,
  focal_x      REAL NOT NULL DEFAULT 50,
  focal_y      REAL NOT NULL DEFAULT 50,
  zoom         REAL NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_home_slots_single
  ON site_home_slots (slot) WHERE slot <> 'work';
CREATE UNIQUE INDEX IF NOT EXISTS site_home_slots_work_project
  ON site_home_slots (project_slug) WHERE slot = 'work';
CREATE TABLE IF NOT EXISTS testimonials (
  id           TEXT PRIMARY KEY,
  brand        TEXT NOT NULL,
  person       TEXT NOT NULL,
  comment      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','published','hidden','rejected')),
  sort_order   INT NOT NULL DEFAULT 0,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS testimonials_status_idx ON testimonials (status, sort_order);
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  count      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const MIGRATIONS = [
  {
    id: 1,
    name: "baseline-studio-schema",
    statements: BASELINE_SCHEMA.split(";").map((s) => s.trim()).filter(Boolean),
    // If every one of these already exists the baseline is *adopted* (recorded
    // without executing anything) instead of run.
    adopt: {
      tables: [
        "studio_budgets",
        "studio_counters",
        "site_images",
        "site_home_slots",
        "testimonials",
        "rate_limits",
      ],
      indexes: ["site_home_slots_single", "site_home_slots_work_project", "testimonials_status_idx"],
    },
  },
];

// Migration 2 = Portal Fase 1: clients, sessions, goals, content, activity.
// Additive only. Statements are an array (no SQL splitting).
MIGRATIONS.push({
  id: 2,
  name: "portal-phase1-clients-content",
  statements: [
    `CREATE TABLE IF NOT EXISTS clients (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      display_name      TEXT NOT NULL,
      slug              TEXT NOT NULL UNIQUE,
      login_key         TEXT NOT NULL UNIQUE,
      active            BOOLEAN NOT NULL DEFAULT true,
      accent            TEXT,
      notes             TEXT,
      code_hash         TEXT,
      code_generated_at TIMESTAMPTZ,
      last_login_at     TIMESTAMPTZ,
      failed_attempts   INT NOT NULL DEFAULT 0,
      lockouts          INT NOT NULL DEFAULT 0,
      locked_until      TIMESTAMPTZ,
      settings          JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS clients_active_idx ON clients (active, name)`,
    `CREATE TABLE IF NOT EXISTS client_sessions (
      id           TEXT PRIMARY KEY,
      client_id    TEXT NOT NULL REFERENCES clients(id),
      token_hash   TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at   TIMESTAMPTZ NOT NULL,
      revoked_at   TIMESTAMPTZ,
      ip_hash      TEXT,
      user_agent   TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS client_sessions_client_idx ON client_sessions (client_id)`,
    `CREATE INDEX IF NOT EXISTS client_sessions_expires_idx ON client_sessions (expires_at)`,
    `CREATE TABLE IF NOT EXISTS client_month_goals (
      client_id  TEXT NOT NULL REFERENCES clients(id),
      month      TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      contracted INT NOT NULL CHECK (contracted >= 0),
      PRIMARY KEY (client_id, month)
    )`,
    `CREATE TABLE IF NOT EXISTS content_items (
      id                 TEXT PRIMARY KEY,
      client_id          TEXT NOT NULL REFERENCES clients(id),
      title              TEXT NOT NULL,
      platform           TEXT NOT NULL,
      content_type       TEXT NOT NULL,
      scheduled_at       TIMESTAMPTZ,
      status             TEXT NOT NULL DEFAULT 'idea'
                         CHECK (status IN ('idea','production','review','client_review',
                                           'changes_requested','approved','scheduled','published','cancelled')),
      copy               TEXT,
      internal_notes     TEXT,
      client_notes       TEXT,
      assignee           TEXT,
      version            INT NOT NULL DEFAULT 1,
      sent_to_client_at  TIMESTAMPTZ,
      published_at       TIMESTAMPTZ,
      published_url      TEXT,
      preview_url        TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT content_items_id_client UNIQUE (id, client_id)
    )`,
    `CREATE INDEX IF NOT EXISTS content_items_client_sched_idx ON content_items (client_id, scheduled_at)`,
    `CREATE INDEX IF NOT EXISTS content_items_client_status_idx ON content_items (client_id, status)`,
    `CREATE INDEX IF NOT EXISTS content_items_sched_idx ON content_items (scheduled_at)`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      seq            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id      TEXT NOT NULL REFERENCES clients(id),
      content_id     TEXT,
      actor_type     TEXT NOT NULL CHECK (actor_type IN ('admin','client','system')),
      actor_name     TEXT,
      event          TEXT NOT NULL,
      data           JSONB NOT NULL DEFAULT '{}'::jsonb,
      client_visible BOOLEAN NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT activity_log_content_fk FOREIGN KEY (content_id, client_id)
        REFERENCES content_items (id, client_id)
    )`,
    `CREATE INDEX IF NOT EXISTS activity_log_client_idx ON activity_log (client_id, seq DESC)`,
    `CREATE INDEX IF NOT EXISTS activity_log_content_idx ON activity_log (content_id, seq DESC)`,
  ],
});

// Migration 3 = Portal Fase 2: comments, approvals (append-only), tasks.
// Additive only; no existing table is altered.
MIGRATIONS.push({
  id: 3,
  name: "portal-phase2-approvals-comments-tasks",
  statements: [
    `CREATE TABLE IF NOT EXISTS content_comments (
      id          TEXT PRIMARY KEY,
      content_id  TEXT NOT NULL,
      client_id   TEXT NOT NULL REFERENCES clients(id),
      author_type TEXT NOT NULL CHECK (author_type IN ('studio','client')),
      author_name TEXT NOT NULL,
      body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT content_comments_content_fk FOREIGN KEY (content_id, client_id)
        REFERENCES content_items (id, client_id)
    )`,
    `CREATE INDEX IF NOT EXISTS content_comments_content_idx ON content_comments (content_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS content_approvals (
      id              TEXT PRIMARY KEY,
      content_id      TEXT NOT NULL,
      client_id       TEXT NOT NULL REFERENCES clients(id),
      action          TEXT NOT NULL CHECK (action IN ('approved','changes_requested','manual_approval')),
      actor_name      TEXT NOT NULL,
      actor_type      TEXT NOT NULL CHECK (actor_type IN ('client','studio')),
      session_id      TEXT REFERENCES client_sessions(id),
      from_status     TEXT NOT NULL,
      to_status       TEXT NOT NULL,
      content_version INT NOT NULL,
      comment_id      TEXT REFERENCES content_comments(id),
      metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT content_approvals_content_fk FOREIGN KEY (content_id, client_id)
        REFERENCES content_items (id, client_id)
    )`,
    `CREATE INDEX IF NOT EXISTS content_approvals_content_idx ON content_approvals (content_id, created_at)`,
    `CREATE OR REPLACE FUNCTION content_approvals_immutable() RETURNS trigger AS $$
     BEGIN RAISE EXCEPTION 'content_approvals es append-only'; END;
     $$ LANGUAGE plpgsql`,
    `CREATE OR REPLACE TRIGGER content_approvals_append_only
       BEFORE UPDATE OR DELETE ON content_approvals
       FOR EACH ROW EXECUTE FUNCTION content_approvals_immutable()`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id                   TEXT PRIMARY KEY,
      client_id            TEXT REFERENCES clients(id),
      content_id           TEXT,
      title                TEXT NOT NULL,
      description          TEXT,
      assignee             TEXT,
      due_date             DATE,
      priority             TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
      status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
      visibility           TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client')),
      kind                 TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','change_request')),
      completed_at         TIMESTAMPTZ,
      completed_by         TEXT,
      completed_session_id TEXT REFERENCES client_sessions(id),
      created_by           TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT tasks_client_visible_needs_client CHECK (visibility <> 'client' OR client_id IS NOT NULL),
      CONSTRAINT tasks_content_needs_client CHECK (content_id IS NULL OR client_id IS NOT NULL),
      CONSTRAINT tasks_content_fk FOREIGN KEY (content_id, client_id)
        REFERENCES content_items (id, client_id)
    )`,
    `CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks (client_id, status)`,
    `CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (due_date) WHERE status IN ('pending','in_progress')`,
    `CREATE INDEX IF NOT EXISTS tasks_content_idx ON tasks (content_id)`,
  ],
});

// Migration 4 = Portal Fase 3: private client files (metadata; bytes live in a
// separate PRIVATE Vercel Blob store). Additive only.
MIGRATIONS.push({
  id: 4,
  name: "portal-phase3-client-files",
  statements: [
    `CREATE TABLE IF NOT EXISTS client_files (
      id               TEXT PRIMARY KEY,
      client_id        TEXT NOT NULL REFERENCES clients(id),
      content_id       TEXT,
      category         TEXT NOT NULL CHECK (category IN
                         ('brand_assets','logos','photos','videos','deliverables','documents','content','other')),
      name             TEXT NOT NULL,
      original_name    TEXT NOT NULL,
      blob_pathname    TEXT NOT NULL UNIQUE,
      mime             TEXT NOT NULL,
      size             BIGINT NOT NULL CHECK (size >= 0),
      access           TEXT NOT NULL DEFAULT 'private' CHECK (access IN ('private','public')),
      version          INT NOT NULL DEFAULT 1 CHECK (version >= 1),
      group_key        TEXT NOT NULL,
      is_final         BOOLEAN NOT NULL DEFAULT false,
      client_visible   BOOLEAN NOT NULL DEFAULT true,
      description      TEXT,
      uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('studio','client')),
      uploaded_by_name TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ,
      deleted_by       TEXT,
      purged_at        TIMESTAMPTZ,
      CONSTRAINT client_files_content_fk FOREIGN KEY (content_id, client_id)
        REFERENCES content_items (id, client_id),
      CONSTRAINT client_files_group_version UNIQUE (group_key, version)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS client_files_one_final
       ON client_files (group_key) WHERE is_final AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS client_files_client_idx ON client_files (client_id, category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS client_files_content_idx ON client_files (content_id) WHERE content_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS client_files_deleted_idx ON client_files (deleted_at) WHERE deleted_at IS NOT NULL AND purged_at IS NULL`,
  ],
});
