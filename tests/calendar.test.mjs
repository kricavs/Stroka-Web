import test from "node:test";
import assert from "node:assert/strict";
import { groupByDay, groupByWeek, monthGrid, viewRange, weekDays } from "../lib/shared/calendar.js";
import { parseCalendarParams, calendarHref } from "../lib/studio/calendar-params.js";
import { canTransition, isClientVisible, TRANSITIONS, STATUSES } from "../lib/shared/content.js";
import { loginKey, slugify } from "../lib/shared/slug.js";

test("monthGrid: semanas completas lunes-domingo", () => {
  const g = monthGrid("2026-11"); // 1/11/2026 es domingo
  assert.equal(g[0][0], "2026-10-26");
  assert.equal(g[0][6], "2026-11-01");
  assert.equal(g.at(-1)[6], "2026-12-06");
  assert.ok(g.every((w) => w.length === 7));
});

test("groupByDay usa Buenos Aires: 02:00Z del 1/11 es 31/10 23:00 local", () => {
  const { byDay, undated } = groupByDay([
    { id: "a", scheduledAt: "2026-11-01T02:00:00Z" },
    { id: "b", scheduledAt: "2026-11-01T15:00:00Z" },
    { id: "c", scheduledAt: null },
  ]);
  assert.deepEqual(byDay.get("2026-10-31").map((x) => x.id), ["a"]);
  assert.deepEqual(byDay.get("2026-11-01").map((x) => x.id), ["b"]);
  assert.equal(undated.length, 1);
  assert.equal(groupByWeek([{ id: "a", scheduledAt: "2026-11-04T15:00:00Z" }]).weeks[0].start, "2026-11-02");
});

test("viewRange semana y mes cubren los días visibles", () => {
  const w = viewRange("week", "2026-11-04");
  assert.equal(w.start.toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(w.end.toISOString(), "2026-11-09T03:00:00.000Z");
  assert.equal(weekDays("2026-11-04").length, 7);
});

test("parámetros de calendario: valores inválidos se descartan", () => {
  const s = parseCalendarParams({ view: "x", date: "2026-02-30", platform: "myspace", status: "published", client: "c1" });
  assert.equal(s.view, "month");
  assert.notEqual(s.date, "2026-02-30");
  assert.equal(s.platform, "");
  assert.equal(s.status, "published");
  assert.equal(calendarHref("/a?tab=calendario", { view: "week", date: "2026-11-04" }), "/a?tab=calendario&view=week&date=2026-11-04");
});

test("estados: todo destino es un estado conocido; cancelled/idea/review invisibles al cliente", () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(STATUSES.includes(from));
    for (const to of tos) assert.ok(STATUSES.includes(to));
  }
  assert.ok(canTransition("client_review", "changes_requested"));
  assert.ok(!canTransition("idea", "published"));
  for (const s of ["idea", "review", "cancelled"]) assert.ok(!isClientVisible(s));
});

test("slug y clave de login", () => {
  assert.equal(slugify("Laboratorio Millet S.A."), "laboratorio-millet-s-a");
  assert.equal(loginKey(" laboratorio  MILLET s.a "), loginKey("Laboratório Millet S.A."));
});
