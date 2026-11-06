// Minimal, strict .xlsx reader. Node-only (zlib). Reads VALUES, nothing else:
//  - formulas are never evaluated (the cached value is read and flagged);
//  - macros (.xlsm), encryption, ZIP64, external links and connections are
//    rejected or ignored, never followed;
//  - the ZIP is bounded by size, entry count and a hard cap on inflated output
//    (zlib `maxOutputLength`), so a lying or bomb-like archive fails cleanly;
//  - XML is scanned with indexOf (no DTD/entity expansion, no regex backtracking).
// Why not a library: the community SheetJS build on npm is outdated (known
// prototype-pollution/ReDoS advisories) and exceljs pulls a large tree; neither
// lets us bound inflation. Here we need only text, numbers and date cells.
import { inflateRawSync } from "node:zlib";
import { InputError } from "../studio/errors.js";
import * as L from "./limits.js";

export class XlsxError extends InputError {
  constructor(code, message, status = 400) {
    super(message, status);
    this.name = "XlsxError";
    this.code = code;
  }
}

const fail = (code, msg, status) => { throw new XlsxError(code, msg, status); };

// ---- ZIP ---------------------------------------------------------------

function readZip(buf) {
  if (!(buf instanceof Uint8Array)) fail("not_zip", "El archivo no es un .xlsx válido.");
  if (buf.length < 22) fail("not_zip", "El archivo no es un .xlsx válido.");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Legacy .xls (OLE2) and anything that is not a ZIP.
  if (dv.getUint32(0, true) === 0xe011cfd0 || (buf[0] === 0xd0 && buf[1] === 0xcf)) fail("legacy_xls", "Ese es un .xls antiguo. Guardalo como .xlsx (Libro de Excel) y volvé a subirlo.");
  if (!(buf[0] === 0x50 && buf[1] === 0x4b)) fail("not_zip", "El archivo no es un .xlsx válido (no es un ZIP).");

  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) fail("corrupt", "El archivo está dañado (no se encontró el índice del ZIP).");
  const total = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail("unsupported", "El archivo usa ZIP64, que no se admite.");
  if (total > L.MAX_ZIP_ENTRIES) fail("too_many_entries", "El archivo contiene demasiadas partes internas.");
  if (cdOffset + cdSize > buf.length) fail("corrupt", "El archivo está dañado (índice fuera de rango).");

  const entries = new Map();
  let p = cdOffset;
  let declared = 0;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) fail("corrupt", "El archivo está dañado (entrada inválida).");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    if (p + 46 + nlen > buf.length) fail("corrupt", "El archivo está dañado.");
    const name = new TextDecoder("utf-8").decode(buf.subarray(p + 46, p + 46 + nlen));
    if (flags & 1) fail("encrypted", "El archivo está protegido con contraseña.");
    if (entries.has(name)) fail("corrupt", "El archivo está dañado (partes duplicadas).");
    if (usize > L.MAX_PART_BYTES) fail("too_large_inflated", "El contenido del archivo es demasiado grande.", 413);
    declared += usize;
    if (declared > L.MAX_UNCOMPRESSED_BYTES) fail("too_large_inflated", "El contenido del archivo es demasiado grande.", 413);
    entries.set(name, { method, csize, usize, lho });
    p += 46 + nlen + elen + clen;
  }

  const read = (name) => {
    const e = entries.get(name);
    if (!e) return null;
    if (e.lho + 30 > buf.length || dv.getUint32(e.lho, true) !== 0x04034b50) fail("corrupt", "El archivo está dañado (cabecera local).");
    const start = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true);
    if (start + e.csize > buf.length) fail("corrupt", "El archivo está dañado (datos incompletos).");
    const raw = buf.subarray(start, start + e.csize);
    let out;
    if (e.method === 0) out = raw;
    else if (e.method === 8) {
      try {
        // Hard stop at the declared size: a lie about it cannot inflate more.
        out = inflateRawSync(raw, { maxOutputLength: Math.max(e.usize, 1) });
      } catch {
        fail("corrupt", "El archivo está dañado o declara un tamaño falso.");
      }
    } else fail("unsupported", "El archivo usa una compresión no admitida.");
    if (out.length !== e.usize) fail("corrupt", "El archivo está dañado (tamaño inconsistente).");
    return out;
  };
  return { names: [...entries.keys()], read };
}

// ---- XML helpers (no parser: bounded scans) ----------------------------

const utf8 = (u8) => new TextDecoder("utf-8").decode(u8);

function entities(s) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/g, (m, g) => {
    if (g === "amp") return "&";
    if (g === "lt") return "<";
    if (g === "gt") return ">";
    if (g === "quot") return '"';
    if (g === "apos") return "'";
    const cp = g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : "";
  });
}

function safeXml(buf, what) {
  const xml = utf8(buf);
  // We never need a DTD: refusing it removes the entity-expansion class entirely.
  if (xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) fail("unsafe_xml", `El archivo contiene XML no permitido (${what}).`);
  return xml;
}

// Attribute value of `name` inside a start-tag string.
function attr(tag, name) {
  const re = new RegExp(`[\\s]${name}="([^"]*)"`);
  const m = re.exec(tag);
  return m ? entities(m[1]) : null;
}

// Calls fn(startTag, inner) for every <name …>…</name> or <name …/>.
function each(xml, name, fn) {
  const open = `<${name}`;
  let i = 0;
  for (;;) {
    i = xml.indexOf(open, i);
    if (i < 0) return;
    const c = xml.charCodeAt(i + open.length);
    // must be exactly this element (next char: space, '>' or '/')
    if (!(c === 32 || c === 62 || c === 47 || c === 10 || c === 13 || c === 9)) { i += open.length; continue; }
    const gt = xml.indexOf(">", i);
    if (gt < 0) return;
    const tag = xml.slice(i, gt + 1);
    if (xml[gt - 1] === "/") { fn(tag, ""); i = gt + 1; continue; }
    const close = xml.indexOf(`</${name}>`, gt);
    if (close < 0) return;
    fn(tag, xml.slice(gt + 1, close));
    i = close + name.length + 3;
  }
}

// All <t> text inside (rich text runs concatenated; phonetic runs ignored).
function textOf(inner) {
  const clean = inner.includes("<rPh") ? inner.replace(/<rPh[\s\S]*?<\/rPh>/g, "") : inner;
  let out = "";
  each(clean, "t", (_, v) => { out += v; });
  return entities(out);
}

const colIndex = (ref) => {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
};

// ---- number formats → "is this a date?" --------------------------------

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function isDateFormat(code) {
  const stripped = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmyhs]/i.test(stripped);
}

function readStyles(buf) {
  if (!buf) return [];
  const xml = safeXml(buf, "estilos");
  const custom = new Map();
  each(xml, "numFmt", (tag) => {
    const id = Number(attr(tag, "numFmtId"));
    const code = attr(tag, "formatCode");
    if (Number.isFinite(id) && code != null) custom.set(id, code);
  });
  const xfs = [];
  let inXfs = "";
  each(xml, "cellXfs", (_, inner) => { inXfs = inner; });
  each(inXfs, "xf", (tag) => {
    const id = Number(attr(tag, "numFmtId") ?? 0);
    xfs.push(BUILTIN_DATE.has(id) || (custom.has(id) && isDateFormat(custom.get(id))));
  });
  return xfs;
}

// ---- workbook ------------------------------------------------------------

/**
 * @returns {{ sheets: { name: string, rows: { r: number, cells: (Cell|null)[] }[] }[], ignored: string[] }}
 * Cell = { kind: 'str'|'num'|'date'|'bool'|'err', v: string|number|boolean, formula?: true }
 * Dates stay as Excel serial numbers (kind 'date'); the parser converts them.
 */
export function readXlsx(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (buf.length > L.MAX_XLSX_BYTES) fail("too_large", `El archivo supera el máximo de ${L.MAX_XLSX_BYTES / L.MB} MB.`, 413);
  const zip = readZip(buf);
  const names = new Set(zip.names);

  if (!names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) fail("not_xlsx", "El archivo no parece un libro de Excel (.xlsx).");
  const ct = safeXml(zip.read("[Content_Types].xml"), "tipos");
  if (names.has("xl/vbaProject.bin") || /macroEnabled/i.test(ct)) fail("macros", "El archivo contiene macros (.xlsm). Guardalo como .xlsx sin macros.");
  if (!/spreadsheetml\.sheet\.main\+xml/.test(ct)) fail("not_xlsx", "El archivo no parece un libro de Excel (.xlsx).");

  const ignored = [];
  if ([...names].some((n) => n.startsWith("xl/externalLinks/")) || names.has("xl/connections.xml")) ignored.push("conexiones externas");

  const wb = safeXml(zip.read("xl/workbook.xml"), "libro");
  const relsBuf = zip.read("xl/_rels/workbook.xml.rels");
  if (!relsBuf) fail("not_xlsx", "El archivo está incompleto (faltan relaciones del libro).");
  const rels = new Map();
  each(safeXml(relsBuf, "relaciones"), "Relationship", (tag) => {
    rels.set(attr(tag, "Id"), { target: attr(tag, "Target"), type: attr(tag, "Type") || "" });
  });

  const declared = [];
  each(wb, "sheet", (tag) => {
    const rid = attr(tag, "r:id") ?? attr(tag, "id");
    declared.push({ name: attr(tag, "name"), state: attr(tag, "state") || "visible", rid });
  });
  if (!declared.length) fail("no_sheets", "El libro no tiene hojas.");
  if (declared.length > L.MAX_SHEETS) fail("too_many_sheets", `El libro tiene demasiadas hojas (máximo ${L.MAX_SHEETS}).`);

  const shared = [];
  const ssBuf = zip.read("xl/sharedStrings.xml");
  if (ssBuf) each(safeXml(ssBuf, "textos"), "si", (_, inner) => { shared.push(textOf(inner)); });
  const dateXf = readStyles(zip.read("xl/styles.xml"));

  const sheets = [];
  for (const s of declared) {
    if (s.state !== "visible") { ignored.push(`hoja oculta «${s.name}»`); continue; }
    const rel = rels.get(s.rid);
    if (!rel || !/worksheet$/.test(rel.type)) { ignored.push(`hoja «${s.name}» (no es una hoja de cálculo)`); continue; }
    const path = rel.target.startsWith("/") ? rel.target.slice(1) : `xl/${rel.target}`;
    const buf2 = zip.read(path);
    if (!buf2) fail("not_xlsx", "El archivo está incompleto (falta una hoja).");
    sheets.push({ name: s.name, rows: readSheet(safeXml(buf2, "hoja"), shared, dateXf) });
  }
  if (!sheets.length) fail("no_sheets", "El libro no tiene hojas visibles.");
  return { sheets, ignored };
}

function readSheet(xml, shared, dateXf) {
  const rows = [];
  let n = 0;
  each(xml, "row", (rowTag, inner) => {
    const r = Number(attr(rowTag, "r")) || rows.length + 1;
    const cells = [];
    let any = false;
    each(inner, "c", (tag, body) => {
      const ref = attr(tag, "r") || "";
      const col = colIndex(ref);
      if (col < 0) return;
      if (col >= L.MAX_COLS) { if (body.includes("<v") || body.includes("<is")) fail("too_many_columns", `La hoja tiene demasiadas columnas con datos (máximo ${L.MAX_COLS}).`); return; }
      const t = attr(tag, "t");
      const s = Number(attr(tag, "s"));
      const hasF = body.includes("<f");
      let vRaw = null;
      each(body, "v", (_, v) => { vRaw = v; });
      let cell = null;
      if (t === "inlineStr") {
        let txt = "";
        each(body, "is", (_, is) => { txt = textOf(is); });
        cell = { kind: "str", v: txt };
      } else if (vRaw !== null) {
        if (t === "s") {
          const idx = Number(vRaw);
          cell = Number.isInteger(idx) && idx >= 0 && idx < shared.length ? { kind: "str", v: shared[idx] } : null;
        } else if (t === "str") cell = { kind: "str", v: entities(vRaw) };
        else if (t === "b") cell = { kind: "bool", v: vRaw === "1" };
        else if (t === "e") cell = { kind: "err", v: entities(vRaw) };
        else if (t === "d") cell = { kind: "str", v: entities(vRaw), iso: true };
        else {
          const num = Number(vRaw);
          if (Number.isFinite(num)) cell = { kind: Number.isInteger(s) && dateXf[s] ? "date" : "num", v: num };
        }
      }
      if (cell && typeof cell.v === "string") {
        if (cell.v.length > L.MAX_CELL_CHARS) fail("cell_too_long", `Una celda supera los ${L.MAX_CELL_CHARS} caracteres (${ref}).`);
      }
      if (cell && hasF) cell.formula = true;
      if (cell) { cells[col] = cell; any = true; }
    });
    if (any) {
      n++;
      if (n > L.MAX_ROWS_PER_SHEET) fail("too_many_rows", `Una hoja supera las ${L.MAX_ROWS_PER_SHEET} filas con datos.`);
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null;
      rows.push({ r, cells });
    }
  });
  return rows;
}
