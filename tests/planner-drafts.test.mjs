import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { memoryDb } from "./helpers.mjs";
import { MIGRATIONS } from "../lib/studio/server/migrations.js";
import { runMigrations } from "../lib/studio/server/migrate.js";
import * as clients from "../lib/studio/clients-core.js";
import * as contentCore from "../lib/studio/content-core.js";
import { parsePlanningWorkbook } from "../lib/planner/parser.js";
import * as P from "../lib/planner/drafts-core.js";
import { serial, torquenRows, torquenXlsx } from "./helpers-xlsx.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");

async function world() {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS);
  const a = await clients.createClient(db, { name: "Torquen demo" });
  const b = await clients.createClient(db, { name: "Otro cliente" });
  return { db, a, b };
}

// Excel → parser → the SAME entry point an AI/MCP source will use.
async function importXlsx(w, buf, { clientId = w.a, ...over } = {}) {
  const parsed = parsePlanningWorkbook(buf);
  return P.createPlanningDraft(w.db, {
    sourceType: "xlsx", clientId, items: parsed.items, notes: parsed.notes, issues: parsed.issues, sourceName: "Torquen_Calendario_Noviembre_2026.xlsx",
    sourceHash: sha(buf), defaultPlatform: "instagram", ...over,
  });
}
const count = async (db, t, where = "true") => (await db.query(`select count(*)::int n from ${t} where ${where}`))[0].n;
const item = (d, code) => d.items.find((i) => i.externalCode === code);

test("migración 5: tablas y constraints; la 1–4 no cambian", async () => {
  const w = await world();
  assert.deepEqual((await w.db.query(`select id from schema_migrations order by id`)).map((r) => r.id), [1, 2, 3, 4, 5]);
  const ins = (extra) => w.db.query(`insert into planning_drafts (id, client_id, source_type, period_month, default_platform, default_content_status ${extra.cols || ""}) values ('x','${w.a}','${extra.src || "xlsx"}','${extra.month || "2026-11"}','instagram','${extra.st || "production"}' ${extra.vals || ""})`);
  await assert.rejects(ins({ src: "pdf" }), /check/i);
  await assert.rejects(ins({ month: "2026-13" }), /check/i);
  await assert.rejects(ins({ st: "approved" }), /check/i);
  await assert.rejects(ins({ cols: ", status", vals: ", 'applied'" }), /check/i, "applied exige applied_at");
  await ins({});
});

test("crear borrador: no toca content_items y deja todo analizado", async () => {
  const w = await world();
  const before = await count(w.db, "content_items");
  const r = await importXlsx(w, torquenXlsx());
  assert.equal(await count(w.db, "content_items"), before);
  assert.equal(await count(w.db, "planning_content_links"), 0);
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual([d.status, d.period, d.sourceType, d.defaultPlatform, d.defaultContentStatus, d.defaultTime], ["draft", "2026-11", "xlsx", "instagram", "production", "12:00"]);
  assert.equal(d.items.length, 6);
  assert.equal(d.notes.length, 4);
  assert.deepEqual([r.summary.create, r.summary.update, r.summary.errors, r.summary.warnings], [6, 0, 0, 1]);
  assert.equal(item(d, "R1").contentType, "reel"); assert.equal(item(d, "G2").contentType, "post");
  assert.equal(item(d, "H1").contentType, "story"); assert.equal(item(d, "G1").contentType, "carousel");
  assert.equal(item(d, "R1").time, null);
});

test("entrada común: la misma función acepta un origen 'ai' con items a mano", async () => {
  const w = await world();
  const r = await P.createPlanningDraft(w.db, {
    sourceType: "ai", clientId: w.a, defaultPlatform: "Instagram", period: "2026-12",
    items: [{ date: "2026-12-02", time: "18:00", externalCode: "x1", format: "Reel", title: "Idea generada", detail: "d" }],
  });
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(d.sourceType, "ai"); assert.equal(d.items[0].externalCode, "X1"); assert.equal(d.items[0].time, "18:00");
  assert.equal(d.sourceName, null);
});

test("validaciones de entrada: plataforma obligatoria (no se infiere), estado, origen, cliente, mes", async () => {
  const w = await world();
  const parsed = parsePlanningWorkbook(torquenXlsx());
  const base = { sourceType: "xlsx", clientId: w.a, items: parsed.items, defaultPlatform: "instagram" };
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, defaultPlatform: undefined }), /plataforma/i);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, defaultPlatform: "myspace" }), /plataforma/i);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, defaultContentStatus: "published" }), /Estado inicial/);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, defaultContentStatus: "approved" }), /Estado inicial/);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, sourceType: "pdf" }), /Origen/);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, clientId: "cli_nope" }), (e) => e.status === 404);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, items: [] }), /no tiene piezas/);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, sourceHash: "abc" }), /Huella/);
  await assert.rejects(P.createPlanningDraft(w.db, { ...base, defaultTime: "25:99" }), /Hora/);
  const idea = await P.createPlanningDraft(w.db, { ...base, defaultContentStatus: "idea" });
  assert.equal((await P.getPlanningDraft(w.db, w.a, idea.id)).defaultContentStatus, "idea");
});

test("aplicar: crea los contenidos (estado, plataforma, hora por defecto en Buenos Aires, notas internas), vínculos y actividad", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  const done = await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual(done, { created: 6, updated: 0, skipped: 0, noChange: 0 });
  const rows = await w.db.query(`select * from content_items where client_id=$1 order by scheduled_at, title`, [w.a]);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((c) => c.status === "production" && c.platform === "instagram"));
  const r1 = rows.find((c) => /modelo A/.test(c.title));
  assert.equal(r1.scheduled_at.toISOString(), "2026-11-06T15:00:00.000Z", "12:00 en Buenos Aires (UTC-3), no medianoche UTC");
  assert.equal(r1.content_type, "reel");
  assert.equal(r1.internal_notes, "Hook: te presento el modelo A.");
  assert.equal(r1.pillar, "Producto");
  assert.equal(r1.cta, "Escribinos por WhatsApp");
  assert.equal(r1.copy, null, "el copy (texto para el cliente) no se inventa");
  assert.equal(await count(w.db, "planning_content_links"), 6);
  const [dr] = await w.db.query(`select status, applied_at, summary from planning_drafts where id=$1`, [r.id]);
  assert.equal(dr.status, "applied"); assert.ok(dr.applied_at); assert.equal(dr.summary.created, 6);
  const [ev] = await w.db.query(`select data, actor_type from activity_log where event='planning.import_applied'`);
  assert.deepEqual(ev.data, { draftId: r.id, month: "2026-11", source: "xlsx", created: 6, updated: 0, skipped: 0 });
  assert.ok(!JSON.stringify(ev.data).includes("Torquen_Calendario"), "el nombre del archivo no va a la actividad");
  assert.equal(await count(w.db, "activity_log", "event='content.created'"), 6);
  await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 409, "no se aplica dos veces");
});

test("hora explícita y zona horaria: con hora 23:30 cae al día siguiente en UTC; sin hora usa la del borrador", async () => {
  const w = await world();
  const r = await P.createPlanningDraft(w.db, {
    sourceType: "manual", clientId: w.a, defaultPlatform: "instagram", defaultTime: "09:15",
    items: [{ date: "2026-11-06", time: "23:30", format: "Reel", title: "Noche" }, { date: "2026-11-07", format: "Reel", title: "Sin hora" }],
  });
  await P.applyPlanningDraft(w.db, w.a, r.id);
  const rows = await w.db.query(`select title, scheduled_at from content_items order by scheduled_at`);
  assert.deepEqual(rows.map((x) => x.scheduled_at.toISOString()), ["2026-11-07T02:30:00.000Z", "2026-11-07T12:15:00.000Z"]);
});

test("aplicar es atómico: si falla a mitad, no queda nada a medias", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  let n = 0;
  const flaky = { ...w.db, tx: (fn) => w.db.tx((t) => fn({ query: async (sql, p) => { if (/INSERT INTO planning_content_links/.test(sql) && ++n === 4) throw new Error("boom"); return t.query(sql, p); } })) };
  await assert.rejects(P.applyPlanningDraft(flaky, w.a, r.id), /boom/);
  assert.equal(await count(w.db, "content_items"), 0);
  assert.equal(await count(w.db, "planning_content_links"), 0);
  assert.equal(await count(w.db, "activity_log", "event like 'content.%' or event like 'planning.%'"), 0);
  assert.equal((await P.getPlanningDraft(w.db, w.a, r.id)).status, "draft");
  await P.applyPlanningDraft(w.db, w.a, r.id); // y se puede reintentar
  assert.equal(await count(w.db, "content_items"), 6);
});

test("omitir una pieza; las advertencias no bloquean; un error sí", async () => {
  const w = await world();
  const rows = torquenRows();
  rows.cal.push([{ date: serial("2026-11-12") }, "Jue", "Semana 2", "Podcast", "R3", "Formato raro", "", ""]);
  rows.reels.push(["R3", "Raro", "x", "Producto", "y"]);
  const r = await importXlsx(w, torquenXlsx({ rows }));
  let d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(item(d, "R3").validationStatus, "error");
  assert.equal(item(d, "G2").validationStatus, "warning");
  assert.equal(d.summary.errors, 1);
  await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 422 && /error/.test(e.message));
  assert.equal(await count(w.db, "content_items"), 0);
  await P.updatePlanningDraftItem(w.db, w.a, r.id, item(d, "R3").id, { skipped: true });
  await P.updatePlanningDraftItem(w.db, w.a, r.id, item(d, "H2").id, { skipped: true });
  const done = await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual(done, { created: 5, updated: 0, skipped: 2, noChange: 0 });
  d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(await count(w.db, "content_items"), 5);
});

test("editar en la revisión: título, fecha, formato, hora; fecha inválida se muestra como error y se corrige", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  let d = await P.getPlanningDraft(w.db, w.a, r.id);
  const id = item(d, "R1").id;
  const up = (patch) => P.updatePlanningDraftItem(w.db, w.a, r.id, id, patch);
  await up({ title: "Título nuevo", pillar: "Marca", cta: "Visitanos", detail: "Detalle nuevo", time: "18:00", date: "2026-11-20" });
  await up({ date: "2026-02-31" });
  d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(item(d, "R1").validationStatus, "error");
  assert.match(item(d, "R1").issues.find((i) => i.code === "invalid_date").text, /2026-02-31/);
  await up({ date: "2026-12-01" });
  d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.ok(item(d, "R1").issues.some((i) => i.code === "month_mismatch"), "otro mes: inconsistente");
  await up({ date: "2026-11-20", format: "Cosa rara" });
  assert.ok((await P.getPlanningDraft(w.db, w.a, r.id)).items.find((i) => i.id === id).issues.some((i) => i.code === "unmapped_format"));
  await up({ format: "Carrusel" });
  d = await P.getPlanningDraft(w.db, w.a, r.id);
  const it = d.items.find((i) => i.id === id);
  assert.deepEqual([it.title, it.date, it.time, it.contentType, it.validationStatus, it.pillar, it.detail], ["Título nuevo", "2026-11-20", "18:00", "carousel", "valid", "Marca", "Detalle nuevo"]);
  await assert.rejects(up({}), /Nada/);
  await assert.rejects(up({ resolution: "borrar" }), /Resolución/);
  await P.applyPlanningDraft(w.db, w.a, r.id);
  const [c] = await w.db.query(`select title, content_type, scheduled_at from content_items where title='Título nuevo'`);
  assert.equal(c.scheduled_at.toISOString(), "2026-11-20T21:00:00.000Z");
});

test("código duplicado dentro del borrador y mes inconsistente bloquean", async () => {
  const w = await world();
  const r = await P.createPlanningDraft(w.db, {
    sourceType: "manual", clientId: w.a, defaultPlatform: "instagram", period: "2026-11",
    items: [{ date: "2026-11-02", format: "Reel", title: "a", externalCode: "R1" }, { date: "2026-11-03", format: "Reel", title: "b", externalCode: "R1" }, { date: "2026-10-31", format: "Reel", title: "c" }],
  });
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual(d.items.map((i) => i.validationStatus), ["error", "error", "error"]);
  assert.ok(d.items[0].issues.some((i) => i.code === "duplicate_code"));
  assert.ok(d.items[2].issues.some((i) => i.code === "month_mismatch"));
  await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 422);
});

test("reimportar el MISMO archivo: cero duplicados, todo 'sin cambios', y se avisa que ya fue importado", async () => {
  const w = await world();
  const buf = torquenXlsx();
  const first = await importXlsx(w, buf);
  assert.equal(first.previous.length, 0);
  await P.applyPlanningDraft(w.db, w.a, first.id);
  const again = await importXlsx(w, buf);
  assert.equal(again.previous.length, 1, "este archivo ya fue importado");
  assert.equal(again.previous[0].id, first.id); assert.equal(again.previous[0].status, "applied");
  assert.deepEqual([again.summary.create, again.summary.update, again.summary.noChange], [0, 0, 6]);
  const done = await P.applyPlanningDraft(w.db, w.a, again.id);
  assert.deepEqual(done, { created: 0, updated: 0, skipped: 0, noChange: 6 });
  assert.equal(await count(w.db, "content_items"), 6);
  assert.equal((await P.getPlanningDraft(w.db, w.a, again.id)).previous.length, 1);
});

test("reimportar con cambios y sin edición manual → UPDATE (fecha y título), con versión y actividad", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const [before] = await w.db.query(`select c.id, c.version from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = 'R2'`);
  const rows = torquenRows();
  rows.cal[5][0] = { date: serial("2026-11-19") };
  rows.cal[5][5] = "Cómo elegir según tu carga (nueva versión)";
  const r = await importXlsx(w, torquenXlsx({ rows }));
  assert.deepEqual([r.summary.update, r.summary.noChange, r.summary.create], [1, 5, 0]);
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(item(d, "R2").action, "update"); assert.deepEqual(item(d, "R2").analysis.diff.sort(), ["scheduled_at", "title"]);
  const done = await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual(done, { created: 0, updated: 1, skipped: 0, noChange: 5 });
  const [after] = await w.db.query(`select title, scheduled_at, version from content_items where id=$1`, [before.id]);
  assert.equal(after.title, "Cómo elegir según tu carga (nueva versión)");
  assert.equal(after.scheduled_at.toISOString(), "2026-11-19T15:00:00.000Z");
  assert.equal(after.version, before.version + 1, "cambió algo que ve el cliente: sube la versión");
  assert.equal(await count(w.db, "content_items"), 6);
  assert.equal(await count(w.db, "activity_log", "event='content.rescheduled'"), 1);
  // y ahora ese mismo Excel ya no tiene nada nuevo
  assert.equal((await importXlsx(w, torquenXlsx({ rows }))).summary.noChange, 6);
});

test("edición manual en Studio + Excel cambiado → CONFLICT (Studio vs Excel); sin resolver bloquea", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const [c] = await w.db.query(`select c.id from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = 'R1'`);
  await contentCore.updateContent(w.db, c.id, { title: "Título editado a mano en Studio" });
  const rows = torquenRows();
  rows.cal[1][5] = "Título nuevo desde el Excel";
  const r = await importXlsx(w, torquenXlsx({ rows }));
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  const it = item(d, "R1");
  assert.equal(it.action, "conflict");
  assert.equal(it.analysis.current.title, "Título editado a mano en Studio");
  assert.equal(it.analysis.excel.title, "Título nuevo desde el Excel");
  assert.deepEqual(it.analysis.diff, ["title"]);
  assert.equal(d.summary.unresolvedConflicts, 1);
  await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 409 && /conflicto/.test(e.message));
  assert.equal((await w.db.query(`select title from content_items where id=$1`, [c.id]))[0].title, "Título editado a mano en Studio");
});

test("resolver conflicto: conservar Studio (y el mismo Excel no vuelve a chocar) o usar Excel", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const [c] = await w.db.query(`select c.id from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = 'R1'`);
  await contentCore.updateContent(w.db, c.id, { title: "Editado en Studio" });
  const rows = torquenRows();
  rows.cal[1][5] = "Versión del Excel";
  const buf = torquenXlsx({ rows });

  const r1 = await importXlsx(w, buf);
  const id1 = item(await P.getPlanningDraft(w.db, w.a, r1.id), "R1").id;
  await P.updatePlanningDraftItem(w.db, w.a, r1.id, id1, { resolution: "studio" });
  const done = await P.applyPlanningDraft(w.db, w.a, r1.id);
  assert.deepEqual([done.updated, done.skipped], [0, 1]);
  assert.equal((await w.db.query(`select title from content_items where id=$1`, [c.id]))[0].title, "Editado en Studio");
  const r2 = await importXlsx(w, buf); // mismo Excel otra vez
  assert.equal(item(await P.getPlanningDraft(w.db, w.a, r2.id), "R1").action, "no_change", "ya dijiste que Studio gana");

  const rows3 = torquenRows();
  rows3.cal[1][5] = "Otra versión del Excel";
  const r3 = await importXlsx(w, torquenXlsx({ rows: rows3 }));
  const d3 = await P.getPlanningDraft(w.db, w.a, r3.id);
  assert.equal(item(d3, "R1").action, "conflict", "el Excel cambió de nuevo: vuelve a preguntar");
  await P.updatePlanningDraftItem(w.db, w.a, r3.id, item(d3, "R1").id, { resolution: "excel" });
  const done3 = await P.applyPlanningDraft(w.db, w.a, r3.id);
  assert.equal(done3.updated, 1);
  assert.equal((await w.db.query(`select title from content_items where id=$1`, [c.id]))[0].title, "Otra versión del Excel");
});

test("Studio editó pero el Excel no cambió: el trabajo manual se respeta sin conflicto", async () => {
  const w = await world();
  const buf = torquenXlsx();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, buf)).id);
  const [c] = await w.db.query(`select c.id from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = 'R1'`);
  await contentCore.updateContent(w.db, c.id, { title: "Editado a mano", scheduledLocal: "2026-11-06T20:00" });
  const r = await importXlsx(w, buf);
  assert.deepEqual([r.summary.noChange, r.summary.update, r.summary.unresolvedConflicts], [6, 0, 0]);
  await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.equal((await w.db.query(`select title from content_items where id=$1`, [c.id]))[0].title, "Editado a mano");
});

test("un cambio de estado hecho a mano también cuenta como edición manual", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const [c] = await w.db.query(`select c.id from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = 'R2'`);
  await contentCore.changeStatus(w.db, c.id, "review");
  const rows = torquenRows();
  rows.cal[5][0] = { date: serial("2026-11-19") };
  const d = await P.getPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx({ rows }))).id);
  assert.equal(item(d, "R2").action, "conflict");
  assert.equal(item(d, "R2").analysis.manual, true);
});

test("posibles duplicados: contenido manual igual (mismo día, tipo y título) → se omite salvo que lo confirmes", async () => {
  const w = await world();
  await contentCore.createContent(w.db, w.a, { title: "Cómo elegir según tu carga", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-10T10:00" });
  await contentCore.createContent(w.db, w.a, { title: "Otro día", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-11T10:00" });
  const r = await importXlsx(w, torquenXlsx());
  let d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(item(d, "R2").action, "possible_duplicate");
  assert.equal(item(d, "R2").analysis.matchKind, "duplicate");
  assert.equal(item(d, "R1").action, "create");
  assert.equal(r.summary.duplicatesSkipped, 1);
  const done = await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual([done.created, done.skipped], [5, 1]);
  // y confirmado a mano, se crea
  const w2 = await world();
  await contentCore.createContent(w2.db, w2.a, { title: "Cómo elegir según tu carga", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-10T10:00" });
  const r2 = await importXlsx(w2, torquenXlsx());
  d = await P.getPlanningDraft(w2.db, w2.a, r2.id);
  await P.updatePlanningDraftItem(w2.db, w2.a, r2.id, item(d, "R2").id, { resolution: "create" });
  assert.equal((await P.applyPlanningDraft(w2.db, w2.a, r2.id)).created, 6);
  assert.equal(await count(w2.db, "content_items"), 7);
});

test("similitud débil NO es duplicado (otra fecha o distinto tipo)", async () => {
  const w = await world();
  await contentCore.createContent(w.db, w.a, { title: "Cómo elegir según tu carga", platform: "instagram", contentType: "post", scheduledLocal: "2026-11-10T10:00" });
  await contentCore.createContent(w.db, w.a, { title: "Cómo elegir según tu carga", platform: "instagram", contentType: "reel", scheduledLocal: "2026-11-14T10:00" });
  assert.equal((await importXlsx(w, torquenXlsx())).summary.create, 6);
});

test("las piezas que el Excel nuevo ya no menciona se informan y NO se borran", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const rows = torquenRows();
  rows.cal.splice(2, 1); // H1 desaparece del calendario
  rows.hist.splice(1, 1);
  const r = await importXlsx(w, torquenXlsx({ rows }));
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.deepEqual(d.orphans.map((o) => o.code), ["H1"]);
  assert.equal(r.summary.orphans, 1);
  await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.equal(await count(w.db, "content_items"), 6);
});

test("cancelar: queda auditado, no toca contenidos y ya no se puede editar ni aplicar", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  assert.deepEqual(await P.cancelPlanningDraft(w.db, w.a, r.id), { status: "cancelled" });
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  assert.equal(d.status, "cancelled"); assert.ok(d.cancelledAt); assert.equal(d.items.length, 6);
  assert.equal(await count(w.db, "content_items"), 0);
  await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 409);
  await assert.rejects(P.updatePlanningDraftItem(w.db, w.a, r.id, d.items[0].id, { title: "x" }), (e) => e.status === 409);
  await assert.rejects(P.cancelPlanningDraft(w.db, w.a, r.id), (e) => e.status === 409);
  const applied = await importXlsx(w, torquenXlsx());
  await P.applyPlanningDraft(w.db, w.a, applied.id);
  await assert.rejects(P.cancelPlanningDraft(w.db, w.a, applied.id), (e) => e.status === 409 && /aplicada/.test(e.message));
  assert.deepEqual((await P.listPlanningDrafts(w.db, w.a)).map((x) => x.status).sort(), ["applied", "cancelled"]);
});

test("aislamiento: un borrador es de su cliente; el otro cliente recibe 404 y nada se escribe en sus contenidos", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  for (const fn of [
    () => P.getPlanningDraft(w.db, w.b, r.id),
    () => P.applyPlanningDraft(w.db, w.b, r.id),
    () => P.cancelPlanningDraft(w.db, w.b, r.id),
    () => P.updatePlanningDraftItem(w.db, w.b, r.id, "pli_x", { title: "x" }),
  ]) await assert.rejects(fn(), (e) => e.status === 404);
  const d = await P.getPlanningDraft(w.db, w.a, r.id);
  await assert.rejects(P.updatePlanningDraftItem(w.db, w.b, r.id, d.items[0].id, { title: "hack" }), (e) => e.status === 404);
  assert.equal(await count(w.db, "content_items"), 0);
  await P.applyPlanningDraft(w.db, w.a, r.id);
  assert.equal(await count(w.db, "content_items", `client_id='${w.b}'`), 0);
  assert.deepEqual(await P.listPlanningDrafts(w.db, w.b), []);
  // mismo código en otro cliente no se cruza con los vínculos de A
  const rb = await importXlsx(w, torquenXlsx(), { clientId: w.b });
  assert.equal(rb.summary.create, 6);
  assert.equal(rb.previous.length, 0, "la huella se busca solo dentro del cliente");
});

test("dos aplicaciones simultáneas: una gana, la otra recibe 409, sin duplicados", async () => {
  const w = await world();
  const r = await importXlsx(w, torquenXlsx());
  const res = await Promise.allSettled([P.applyPlanningDraft(w.db, w.a, r.id), P.applyPlanningDraft(w.db, w.a, r.id)]);
  assert.equal(res.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(await count(w.db, "content_items"), 6);
});

test("lectura para IA/MCP: mes con la pieza de origen y contexto del cliente (objetivo y notas previas)", async () => {
  const w = await world();
  await clients.setMonthGoal(w.db, w.a, "2026-11", 12);
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const m = await P.getPlanningMonth(w.db, w.a, "2026-11");
  assert.equal(m.contents.length, 6); assert.ok(m.contents.some((c) => c.externalCode === "R1"));
  const ctx = await P.getClientPlanningContext(w.db, w.a, "2026-11");
  assert.equal(ctx.goal, 12); assert.equal(ctx.notes.length, 4); assert.equal(ctx.client.name, "Torquen demo");
  await assert.rejects(P.getPlanningMonth(w.db, w.a, "noviembre"), /Mes inválido/);
});

// ---- Pilar y CTA estructurados (content_items.pillar / cta) ----------------------

const idOf = async (w, code) => (await w.db.query(`select c.id from content_items c join planning_content_links l on l.content_id = c.id where l.external_code = $1`, [code]))[0].id;
// R1 lleva Pilar/CTA en el calendario y en su hoja de detalle: se cambian los dos lugares
const withR1 = (pillar, cta) => {
  const rows = torquenRows();
  if (pillar) { rows.cal[1][6] = pillar; rows.reels[1][3] = pillar; }
  if (cta) { rows.cal[1][7] = cta; rows.reels[1][4] = cta; }
  return torquenXlsx({ rows });
};

test("migración 5 agrega pillar y cta opcionales; el contenido previo queda en NULL", async () => {
  const db = memoryDb();
  await runMigrations(db, MIGRATIONS.filter((m) => m.id < 5));
  const c = await clients.createClient(db, { name: "Viejo" });
  const id = "cnt_viejo";
  await db.query(`insert into content_items (id, client_id, title, platform, content_type, status) values ($1,$2,'Anterior','instagram','post','idea')`, [id, c]);
  await runMigrations(db, MIGRATIONS);
  const cols = (await db.query(`select column_name, is_nullable from information_schema.columns where table_name='content_items' and column_name in ('pillar','cta')`));
  assert.deepEqual(cols.map((x) => [x.column_name, x.is_nullable]).sort(), [["cta", "YES"], ["pillar", "YES"]]);
  const [old] = await db.query(`select pillar, cta from content_items where id=$1`, [id]);
  assert.deepEqual([old.pillar, old.cta], [null, null]);
  // y Studio las admite vacías o cargadas
  const id2 = await contentCore.createContent(db, c, { title: "Nuevo", platform: "instagram", contentType: "post", pillar: "Producto", cta: "Escribinos" });
  assert.deepEqual((await db.query(`select pillar, cta from content_items where id=$1`, [id2]))[0], { pillar: "Producto", cta: "Escribinos" });
});

test("aplicar guarda Pilar y CTA estructurados (sin repetirlos en notas internas) y el snapshot los incluye", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const [c] = await w.db.query(`select internal_notes, pillar, cta from content_items where id=$1`, [await idOf(w, "R1")]);
  assert.deepEqual([c.pillar, c.cta], ["Producto", "Escribinos por WhatsApp"]);
  assert.ok(!/Pilar|CTA|Código/.test(c.internal_notes), "las notas internas conservan solo el detalle");
  const [l] = await w.db.query(`select snapshot from planning_content_links where external_code='R1'`);
  assert.equal(l.snapshot.pillar, "Producto");
  assert.equal(l.snapshot.cta, "Escribinos por WhatsApp");
});

test("Pilar y CTA: sin cambios → NO CHANGE; el Excel los cambia y Studio no tocó → UPDATE", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  assert.equal((await importXlsx(w, torquenXlsx())).summary.noChange, 6);

  const rp = await importXlsx(w, withR1("Autoridad", null));
  const ip = item(await P.getPlanningDraft(w.db, w.a, rp.id), "R1");
  assert.equal(ip.action, "update");
  assert.deepEqual(ip.analysis.diff, ["pillar"]);
  const v0 = (await w.db.query(`select version, status from content_items where id=$1`, [await idOf(w, "R1")]))[0].version;
  await P.applyPlanningDraft(w.db, w.a, rp.id);
  let [c] = await w.db.query(`select pillar, cta, version from content_items where id=$1`, [await idOf(w, "R1")]);
  assert.deepEqual([c.pillar, c.version], ["Autoridad", v0], "pilar es interno: no sube la versión");

  const rc = await importXlsx(w, withR1("Autoridad", "Mirá el video completo"));
  const ic = item(await P.getPlanningDraft(w.db, w.a, rc.id), "R1");
  assert.equal(ic.action, "update");
  assert.deepEqual(ic.analysis.diff, ["cta"]);
  await P.applyPlanningDraft(w.db, w.a, rc.id);
  [c] = await w.db.query(`select pillar, cta from content_items where id=$1`, [await idOf(w, "R1")]);
  assert.deepEqual([c.pillar, c.cta], ["Autoridad", "Mirá el video completo"]);
});

test("Studio cambia Pilar + Excel cambia Pilar → CONFLICT; igual con CTA", async () => {
  for (const [field, studio, excel] of [["pillar", "Pilar de Studio", ["Pilar del Excel", null]], ["cta", "CTA de Studio", [null, "CTA del Excel"]]]) {
    const w = await world();
    await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
    const id = await idOf(w, "R1");
    await contentCore.updateContent(w.db, id, { [field]: studio });
    const r = await importXlsx(w, withR1(...excel));
    const d = await P.getPlanningDraft(w.db, w.a, r.id);
    assert.equal(item(d, "R1").action, "conflict", field);
    assert.deepEqual(item(d, "R1").analysis.diff, [field]);
    assert.equal(d.summary.unresolvedConflicts, 1);
    await assert.rejects(P.applyPlanningDraft(w.db, w.a, r.id), (e) => e.status === 409);
    // Studio edit alone (Excel unchanged) is respected
    const again = await importXlsx(w, torquenXlsx());
    assert.equal(item(await P.getPlanningDraft(w.db, w.a, again.id), "R1").action, "no_change");
  }
});

test("editar Pilar/CTA en Studio no invalida una aprobación (son metadata interna)", async () => {
  const w = await world();
  await P.applyPlanningDraft(w.db, w.a, (await importXlsx(w, torquenXlsx())).id);
  const id = await idOf(w, "R1");
  await w.db.query(`update content_items set status='approved' where id=$1`, [id]);
  const r = await contentCore.updateContent(w.db, id, { pillar: "Otro", cta: "Otro CTA" });
  assert.deepEqual(r.changed.sort(), ["cta", "pillar"]);
  const [c] = await w.db.query(`select status, version from content_items where id=$1`, [id]);
  assert.deepEqual([c.status, c.version], ["approved", 1]);
});
