import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../lib/shared/time.js";

const AR = "America/Argentina/Buenos_Aires";

test("Buenos Aires es UTC-3 fijo", () => {
  assert.equal(T.tzOffsetMinutes(new Date("2026-11-04T12:00:00Z"), AR), -180);
  assert.equal(T.tzOffsetMinutes(new Date("2026-01-15T12:00:00Z"), AR), -180);
});

test("a las 23:30 locales todavía es 'hoy' aunque en UTC ya sea mañana", () => {
  const d = new Date("2026-11-05T02:30:00Z"); // 04/11 23:30 en Buenos Aires
  assert.equal(T.ymd(d, AR), "2026-11-04");
  assert.equal(T.monthKey(new Date("2026-12-01T02:00:00Z"), AR), "2026-11"); // 30/11 23:00 local
});

test("zonedTimeToUtc / rangos", () => {
  assert.equal(T.zonedTimeToUtc({ year: 2026, month: 11, day: 8, hour: 18 }, AR).toISOString(), "2026-11-08T21:00:00.000Z");
  const m = T.monthRange("2026-11", AR);
  assert.equal(m.start.toISOString(), "2026-11-01T03:00:00.000Z");
  assert.equal(m.end.toISOString(), "2026-12-01T03:00:00.000Z");
  const d = T.dayRange("2026-11-04", AR);
  assert.equal(d.end - d.start, 86400000);
  const w = T.weekRange("2026-11-04", AR); // miércoles → lunes 02/11 .. domingo 08/11
  assert.equal(w.start.toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(w.end.toISOString(), "2026-11-09T03:00:00.000Z");
});

test("zona con DST (preparado para timezone por cliente)", () => {
  const NY = "America/New_York";
  assert.equal(T.zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 12 }, NY).toISOString(), "2026-07-01T16:00:00.000Z");
  assert.equal(T.zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 12 }, NY).toISOString(), "2026-12-01T17:00:00.000Z");
  const m = T.monthRange("2026-03", NY); // el mes del cambio de hora dura 743 h
  assert.equal((m.end - m.start) / 3600000, 743);
});

test("aritmética de días/meses y validación", () => {
  assert.equal(T.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(T.addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(T.addMonths("2026-12", 1), "2027-01");
  assert.equal(T.addMonths("2026-01", -1), "2025-12");
  assert.equal(T.weekStart("2026-11-08"), "2026-11-02"); // domingo → lunes anterior
  assert.equal(T.parseYmd("2026-02-30"), null);
  assert.equal(T.parseYmd("basura"), null);
  assert.throws(() => T.monthRange("2026-13x"));
});

test("formato visible", () => {
  const d = new Date("2026-11-08T21:00:00Z");
  assert.equal(T.formatSlot(d, AR), "08 NOV · 18:00");
  assert.equal(T.formatStamp(new Date("2026-11-04T17:32:00Z"), AR), "04/11/2026 · 14:32");
  assert.equal(T.formatMonthLong("2026-11"), "noviembre 2026");
});

test("datetime-local ida y vuelta", () => {
  const d = T.fromLocalInput("2026-11-08T18:00", AR);
  assert.equal(d.toISOString(), "2026-11-08T21:00:00.000Z");
  assert.equal(T.toLocalInput(d, AR), "2026-11-08T18:00");
  assert.equal(T.fromLocalInput("2026-11-08 18:00", AR), null);
  assert.equal(T.fromLocalInput("2026-02-30T10:00", AR), null);
});
