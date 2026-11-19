# Claude / MCP interface

Remote MCP server (Streamable HTTP, stateless) at `/api/mcp`. Auth: `Authorization: Bearer stk_mcp_…`,
one token per Claude project, each bound to exactly ONE client. Tokens are created from
Studio → Cliente → Acceso → Claude / MCP; only the sha256 is stored.

- Tools: `get_client`, `get_calendar`, `get_content`, `get_pending` (read); `create_content`,
  `update_content`, `create_task`, `update_task` (write, need `can_write`). No delete, no bulk.
- The client always comes from the token (`McpScope`); tool input never carries a client id.
- Writes go through the Studio services (`content-core`, `tasks-core`): transitions, versions,
  approval invalidation, activity log, timezone. MCP is another interface, not another backend.
- MCP may only set status `idea | production | review | cancelled`. Sending to the client,
  approving, scheduling and publishing stay in Studio. `internal_notes` is never exposed.
- `scheduled_at` is `YYYY-MM-DDTHH:mm` in America/Argentina/Buenos_Aires.

## Known limitations
- `pillar` and `cta` do not bump `content_items.version` (they are not client-facing), so two
  concurrent writes to those same fields can be last-write-wins. Accepted for v1: each Claude
  project is isolated per client.
- Pre-existing debt (also on `main`): `tests/portal-fase1.test.mjs` hangs.

Local end-to-end check: `node --env-file=.env.local scripts/mcp-smoke.mjs http://localhost:3000` (dev DBs only).
