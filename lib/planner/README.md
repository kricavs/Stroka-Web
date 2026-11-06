# Planner (Phase 5A)

Every plan — from an Excel file today, from AI or Claude/MCP later — becomes a
**planning draft** first. A draft is reviewed and only then **applied** to
`content_items`. Nothing writes to the calendar before `applyPlanningDraft`.

```text
Excel ───────┐
AI (5B) ─────┼→ createPlanningDraft → review / edit → applyPlanningDraft → content_items
Claude/MCP ──┘      (PlanningItemInput, see rules.js)        (one transaction)
```

Postgres/Studio stays the source of truth. The Excel file is never stored: it is
parsed in memory, hashed (SHA-256) and dropped.

## Pieces

| File | Role |
|---|---|
| `limits.js` | Every defensive limit (size, ZIP entries/inflated bytes, sheets, rows, columns, cell length, items). |
| `xlsx-reader.js` | Strict, dependency-free `.xlsx` reader (values only; no formulas, macros, encryption, ZIP64, DTD). |
| `parser.js` | `parsePlanningWorkbook()` — template `stroka-planning-v1`: sheets and columns recognised by **headers**, details joined by code. |
| `rules.js` | The shared contract (`PlanningItemInput`), format/platform/date mapping, validation, what Studio stores. Browser-safe. |
| `drafts-core.js` | Drafts: create, analyze (create/update/no_change/conflict/possible_duplicate), edit, apply, cancel, read models. |

## Re-import without duplicates

`planning_content_links` maps `(client, month, external code)` → content and keeps a
**snapshot** of what the plan last wrote (title, type, platform, date/time, notes,
status, version). On the next import:

- Plan unchanged since last time → `no_change` (Studio's manual edits stand).
- Plan changed, Studio untouched since → `update`.
- Plan changed **and** Studio edited (any tracked field, status or version) → `conflict`: the user chooses Studio or Excel.
  Choosing Studio stores the rejected Excel values (`ack`) so the same file does not conflict again.
- No link, but same day + type + (equal or ≥ 0.8 similar title) → `possible_duplicate` (skipped unless confirmed).
- Items a newer file no longer mentions are reported, never deleted.

No bulk rollback in v1: applying already leaves per-item traceability
(`planning_draft_items.applied_snapshot`, `planning_content_links`) and activity
(`planning.import_applied`, per-content `content.created/updated` with `via: "planning"`).

## Phase 5B — AI (not implemented)

The AI planner will *read* `getClientPlanningContext()` (client, monthly goal,
notes/rules of earlier plans, what the month already holds via `getPlanningMonth()`)
plus calendar history, pillars and important dates, and will *write* the very same
`createPlanningDraft({ sourceType: "ai", … })`. Same preview, same review, same apply.

## Phase 5C — Claude/MCP (not implemented)

An MCP server will expose, 1:1 with `drafts-core.js`:
`getClientPlanningContext`, `getPlanningMonth`, `createPlanningDraft`,
`updatePlanningDraftItem`, `applyPlanningDraft` (+ `cancelPlanningDraft`,
`getPlanningDraft`). It works on **drafts** by default; applying to the calendar is
an explicit, separately authorised action. No public API exists today: every
endpoint is behind the Studio session.

## Where planning data lives

| Datum | Place |
|---|---|
| External code (R1, G4, H10) | `planning_content_links` + draft items (origin metadata, **not** on `content_items`) |
| Pillar, CTA | structured, optional columns `content_items.pillar` / `cta` (migration 5, NULL for older content) |
| Free detail of the piece | `content_items.internal_notes` |

Both `pillar` and `cta` are in `TRACKED_FIELDS`, so they are part of the link snapshot and a
manual edit in Studio is detected as a change on re-import (UPDATE vs CONFLICT like any field).

**Approval invalidation (decision):** neither `pillar` nor `cta` invalidates an approval. Pillar is
internal editorial data; CTA is not shown in the Portal (the DTO does not expose it) and is not part of
`copy`. If CTA is ever shown to the client, add it to `CLIENT_FACING` in `lib/studio/content-core.js`
and `lib/planner/drafts-core.js`.
