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
