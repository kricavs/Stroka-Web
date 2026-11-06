import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parsePlanningWorkbook } from "../lib/planner/parser.js";
import { readXlsx, XlsxError } from "../lib/planner/xlsx-reader.js";
import * as L from "../lib/planner/limits.js";
import { CAL_HEAD, DET_HEAD, makeXlsx, serial, torquenRows, torquenXlsx, zip } from "./helpers-xlsx.mjs";

const codes = (r, c) => r.items.find((i) => i.externalCode === c);
const has = (item, code) => item.warnings.some((w) => w.code === code);
const parseErr = (buf) => { try { parsePlanningWorkbook(buf); } catch (e) { return e; } return null; };

test("workbook Torquen válido: período, 6 piezas, detalles unidos por código, notas aparte", () => {
  const r = parsePlanningWorkbook(torquenXlsx());
  assert.equal(r.period, "2026-11");
  assert.equal(r.items.length, 6);
  assert.deepEqual(r.stats.formats, { Reel: 2, Historia: 2, Carrusel: 1, "Pieza única": 1 });
  const r1 = codes(r, "R1");
  assert.equal(r1.date, "2026-11-06"); assert.equal(r1.time, null);
  assert.equal(r1.detail, "Hook: te presento el modelo A.");
  assert.equal(r1.pillar, "Producto"); assert.equal(r1.cta, "Escribinos por WhatsApp");
  assert.equal(r1.sourceSheet, "Calendario"); assert.equal(r1.sourceRow, 2);
  // G2 is "Pieza única" in Calendario but its detail lives in the carousels sheet: joined by CODE, not by format
  assert.equal(codes(r, "G2").detail, "Pieza única 1080x1350.");
  assert.equal(codes(r, "H1").cta, "Encuesta", "«Formato/CTA» de Historias es el CTA");
  assert.deepEqual(r.workbookIssues ?? r.issues, []);
});

test("notas: se leen como contexto estructurado y NO generan piezas", () => {
  const r = parsePlanningWorkbook(torquenXlsx());
  assert.equal(r.notes.length, 4);
  assert.deepEqual(r.notes[2], { topic: "Black Friday", detail: "Viernes 27/11. La pieza G2 queda sujeta a beneficios confirmados.", sourceRow: 4 });
  assert.equal(r.items.length, 6);
});

test("advertencias determinísticas desde las notas: Black Friday mencionado; domingo", () => {
  const r = parsePlanningWorkbook(torquenXlsx());
  assert.ok(has(codes(r, "G2"), "note_reference"));
  assert.equal(codes(r, "R1").warnings.length, 0);
  const rows = torquenRows();
  rows.cal.push([{ date: serial("2026-11-08") }, "Dom", "Semana 1", "Reel", "R3", "Un domingo", "", ""]);
  rows.reels.push(["R3", "Domingo", "x", "Producto", "y"]);
  const sun = parsePlanningWorkbook(torquenXlsx({ rows }));
  assert.ok(has(codes(sun, "R3"), "sunday"));
});

test("hojas en cualquier orden y con otros nombres: se reconocen por sus encabezados", () => {
  const r = parsePlanningWorkbook(torquenXlsx({ order: ["Notas", "Historias", "Reels", "Carruseles", "Calendario"] }));
  assert.equal(r.items.length, 6);
  assert.equal(codes(r, "R2").detail, "Hook: ¿cuánta carga movés?");
  const renamed = makeXlsx({ sheets: [{ name: "Plan", rows: torquenRows().cal }, { name: "Fichas", rows: torquenRows().reels }] });
  assert.equal(parsePlanningWorkbook(renamed).items.length, 6);
});

test("encabezados con espacios, mayúsculas, acentos y variantes (Cód./Codigo/CÓDIGO)", () => {
  const cal = torquenRows().cal.map((r) => [...r]);
  cal[0] = ["  FECHA ", "dia", "semana", "Formato", "  codigo ", "Titulo/Idea", "pilar", "cta"];
  const det = torquenRows().reels.map((r) => [...r]);
  det[0] = ["CÓDIGO", "TÍTULO", "Descripción  /  enfoque", "Pilar", "CTA"];
  const r = parsePlanningWorkbook(makeXlsx({ sheets: [{ name: "C", rows: cal }, { name: "D", rows: det }] }));
  assert.equal(r.items.length, 6);
  assert.equal(codes(r, "R1").detail, "Hook: te presento el modelo A.");
});

test("columnas extra y texto compartido (sharedStrings) no rompen nada", () => {
  const rows = torquenRows();
  rows.cal = rows.cal.map((r, i) => [...r, i ? "extra" : "Comentario interno", i ? 99 : "Otro"]);
  const r = parsePlanningWorkbook(torquenXlsx({ rows, shared: true }));
  assert.equal(r.items.length, 6);
  assert.equal(r.items[0].title, "Camión modelo A: lo manejás con licencia de auto");
});

test("código inexistente en detalles: advertencia que no bloquea; detalle sin uso: aviso del workbook", () => {
  const rows = torquenRows();
  rows.cal.push([{ date: serial("2026-11-11") }, "Mié", "Semana 2", "Reel", "R9", "Sin ficha", "Producto", "x"]);
  rows.reels.push(["R7", "Huérfano", "nunca se usa", "Producto", "x"]);
  const r = parsePlanningWorkbook(torquenXlsx({ rows }));
  assert.ok(has(codes(r, "R9"), "code_not_in_details"));
  assert.equal(r.items.length, 7);
  assert.ok(r.issues.some((i) => i.code === "unused_detail" && /R7/.test(i.text)));
});

test("código duplicado en el calendario y en los detalles: error ambiguo", () => {
  const rows = torquenRows();
  rows.cal.push([{ date: serial("2026-11-12") }, "Jue", "Semana 2", "Reel", "R1", "Otra vez R1", "Producto", "x"]);
  const a = parsePlanningWorkbook(torquenXlsx({ rows }));
  assert.equal(a.items.filter((i) => has(i, "duplicate_code")).length, 2);
  const rows2 = torquenRows();
  rows2.reels.push(["R2", "Repetido", "otro enfoque", "Educación", "x"]);
  const b = parsePlanningWorkbook(torquenXlsx({ rows: rows2 }));
  assert.ok(has(codes(b, "R2"), "ambiguous_detail"));
});

test("código faltante: error si hay hojas de detalle; solo aviso si no las hay", () => {
  const rows = torquenRows();
  rows.cal[1] = [...rows.cal[1]]; rows.cal[1][4] = null;
  assert.ok(has(parsePlanningWorkbook(torquenXlsx({ rows })).items[0], "missing_code"));
  const alone = makeXlsx({ sheets: [{ name: "Calendario", rows: rows.cal }] });
  const r = parsePlanningWorkbook(alone);
  assert.ok(has(r.items[0], "no_code"));
  assert.ok(!r.items[0].warnings.some((w) => w.level === "error"));
});

test("fechas: texto dd/mm/aaaa y ISO, serial con hora, fecha inválida, vacía y día que no coincide", () => {
  const rows = torquenRows();
  rows.cal[1][0] = "07/11/2026";
  rows.cal[2][0] = "2026-11-08T18:30";
  rows.cal[3][0] = serial("2026-11-09") + 0.75;
  rows.cal[4][0] = "31/02/2026";
  rows.cal[5][0] = null;
  rows.cal[6][1] = "Lun"; // 10 Nov is a Tuesday
  const r = parsePlanningWorkbook(torquenXlsx({ rows }));
  assert.deepEqual([codes(r, "R1").date, codes(r, "R1").time], ["2026-11-07", null]);
  assert.deepEqual([codes(r, "H1").date, codes(r, "H1").time], ["2026-11-08", "18:30"]);
  assert.deepEqual([codes(r, "G1").date, codes(r, "G1").time], ["2026-11-09", "18:00"]);
  assert.ok(has(codes(r, "G2"), "invalid_date"));
  assert.ok(codes(r, "R2").warnings.some((w) => w.code === "invalid_date" && /Falta/.test(w.text)));
  assert.ok(has(codes(r, "H2"), "weekday_mismatch"));
});

test("tipos inesperados: título numérico, celda de error y fórmula con valor guardado (no se evalúa)", () => {
  const rows = torquenRows();
  rows.cal[1][5] = 2026;
  rows.cal[2][5] = { f: "1+1", v: "Titulo cacheado" };
  rows.cal[3][7] = { err: "#REF!" };
  const r = parsePlanningWorkbook(torquenXlsx({ rows }));
  assert.equal(codes(r, "R1").title, "2026"); assert.ok(has(codes(r, "R1"), "unexpected_type"));
  assert.ok(has(codes(r, "H1"), "formula"));
  assert.ok(has(codes(r, "G1"), "cell_error"));
});

test("filas vacías y separadores se ignoran; workbook vacío o sin plantilla: error controlado", () => {
  const rows = torquenRows();
  rows.cal.splice(3, 0, [null, null, null, null, null, null, null, null], [null, null, "Semana 2"]);
  assert.equal(parsePlanningWorkbook(torquenXlsx({ rows })).items.length, 6);
  const e = parseErr(makeXlsx({ sheets: [{ name: "Hoja1", rows: [["a", "b"]] }] }));
  assert.ok(e instanceof XlsxError); assert.equal(e.code, "no_template");
  const empty = parsePlanningWorkbook(makeXlsx({ sheets: [{ name: "C", rows: [CAL_HEAD] }] }));
  assert.ok(empty.issues.some((i) => i.code === "empty" && i.level === "error"));
});

test("hojas ocultas y conexiones externas se ignoran con aviso", () => {
  const rows = torquenRows();
  const buf = makeXlsx({
    sheets: [{ name: "Calendario", rows: rows.cal }, { name: "Reels", rows: rows.reels }, { name: "Secreta", rows: [["x"]] }],
    hiddenSheets: ["Secreta"], extraFiles: [{ name: "xl/externalLinks/externalLink1.xml", data: "<x/>" }],
  });
  const r = parsePlanningWorkbook(buf);
  assert.ok(r.issues.some((i) => i.code === "ignored_parts" && /conexiones externas/.test(i.text) && /Secreta/.test(i.text)));
});

// ---- seguridad ---------------------------------------------------------------

test("seguridad: archivos que no son .xlsx → errores controlados", () => {
  const code = (b) => parseErr(b)?.code;
  assert.equal(code(Buffer.from("no soy un zip, soy texto")), "not_zip");
  assert.equal(code(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(40).fill(0)])), "legacy_xls");
  assert.equal(code(Buffer.from("PK\x03\x04" + "basura".repeat(20))), "corrupt");
  assert.equal(code(zip([{ name: "hola.txt", data: "hola" }])), "not_xlsx", "un ZIP cualquiera renombrado");
  assert.equal(code(makeXlsx({ sheets: [{ name: "C", rows: torquenRows().cal }], macros: true })), "macros");
  assert.equal(code(makeXlsx({ sheets: [{ name: "C", rows: torquenRows().cal }], doctype: true })), "unsafe_xml");
  assert.equal(code(zip([{ name: "x", data: "x", encrypted: true }])), "encrypted");
  const good = torquenXlsx();
  assert.equal(code(good.subarray(0, good.length - 30)), "corrupt", "índice del ZIP cortado");
});

test("seguridad: tamaño máximo del archivo", () => {
  const big = Buffer.alloc(L.MAX_XLSX_BYTES + 1, 1);
  const e = parseErr(big);
  assert.equal(e.code, "too_large"); assert.equal(e.status, 413);
});

test("seguridad: zip bomb declarada y zip que miente sobre su tamaño", () => {
  const zeros = Buffer.alloc(L.MAX_PART_BYTES + 1024, 0);
  const declared = zip([{ name: "[Content_Types].xml", data: zeros }]);
  assert.ok(declared.length < 100_000, "muy comprimido");
  assert.equal(parseErr(declared).code, "too_large_inflated");
  // declares a small size but inflates to far more: must stop at the declared size
  const liar = makeXlsx({ sheets: [{ name: "C", rows: torquenRows().cal }], extraFiles: [{ name: "xl/sharedStrings.xml", data: Buffer.alloc(5_000_000, 0), declaredSize: 100 }] });
  assert.equal(parseErr(liar).code, "corrupt");
  const many = zip(Array.from({ length: L.MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `p${i}.xml`, data: "x" })));
  assert.equal(parseErr(many).code, "too_many_entries");
});

test("seguridad: límites de hojas, filas, columnas, celdas e ítems", () => {
  const sheets = Array.from({ length: L.MAX_SHEETS + 1 }, (_, i) => ({ name: `S${i}`, rows: [["x"]] }));
  assert.equal(parseErr(makeXlsx({ sheets })).code, "too_many_sheets");
  const rows = Array.from({ length: L.MAX_ROWS_PER_SHEET + 5 }, (_, i) => [`v${i}`]);
  assert.equal(parseErr(makeXlsx({ sheets: [{ name: "C", rows }] })).code, "too_many_rows");
  assert.equal(parseErr(makeXlsx({ sheets: [{ name: "C", rows: [Array.from({ length: L.MAX_COLS + 2 }, () => "x")] }] })).code, "too_many_columns");
  assert.equal(parseErr(makeXlsx({ sheets: [{ name: "C", rows: [["x".repeat(L.MAX_CELL_CHARS + 1)]] }] })).code, "cell_too_long");
  const many = [CAL_HEAD, ...Array.from({ length: L.MAX_ITEMS + 1 }, (_, i) => [{ date: serial("2026-11-06") }, "", "", "Reel", `R${i}`, `t${i}`, "", ""])];
  assert.equal(parseErr(makeXlsx({ sheets: [{ name: "C", rows: many }] })).code, "too_many_items");
});

test("lector: no ejecuta nada y entidades XML se decodifican solo las estándar", () => {
  const r = readXlsx(makeXlsx({ sheets: [{ name: "C&D", rows: [["a & b <c> é &unknown;", "<script>alert(1)</script>"]] }] }));
  assert.equal(r.sheets[0].rows[0].cells[0].v, "a & b <c> é &unknown;");
  assert.equal(r.sheets[0].rows[0].cells[1].v, "<script>alert(1)</script>", "texto plano: la UI lo escapa");
});

// Real file (not in the repo): TORQUEN_XLSX=/ruta/al/archivo.xlsx npm test
const REAL = process.env.TORQUEN_XLSX;
test("archivo real de Torquen (opcional)", { skip: !REAL || !existsSync(REAL) }, () => {
  const r = parsePlanningWorkbook(readFileSync(REAL));
  assert.equal(r.period, "2026-11");
  assert.equal(r.items.length, 28);
  assert.equal(r.notes.length, 9);
  assert.deepEqual(r.stats.formats, { Reel: 8, Historia: 12, Carrusel: 6, "Pieza única": 2 });
  assert.equal(r.items.filter((i) => i.warnings.some((w) => w.level === "error")).length, 0);
});
