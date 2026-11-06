// Builds small .xlsx files in memory for tests (no files, no binaries in the repo).
import { deflateRawSync } from "node:zlib";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// files: [{ name, data, store?, declaredSize?, encrypted? }]
export function zip(files) {
  const locals = [], central = [];
  let off = 0;
  for (const f of files) {
    const data = Buffer.from(f.data);
    const body = f.store ? data : deflateRawSync(data);
    const name = Buffer.from(f.name);
    const usize = f.declaredSize ?? data.length;
    const flags = f.encrypted ? 1 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(f.store ? 0 : 8, 8);
    lh.writeUInt32LE(crc32(data), 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(usize, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(f.store ? 0 : 8, 10);
    ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(usize, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

export const serial = (ymd) => Math.round((Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let n = i + 1, out = ""; while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); } return out; };

// cell: string | number | {date: serial} | {f, v} (formula + cached value) | {err} | {bool} | null
export function makeXlsx({ sheets, shared = false, extraFiles = [], macros = false, doctype = false, hiddenSheets = [] }) {
  const sst = [];
  const si = (s) => { let i = sst.indexOf(s); if (i < 0) { sst.push(s); i = sst.length - 1; } return i; };
  const sheetXml = (rows) => {
    const body = rows.map((row, r) => {
      const cells = row.map((c, i) => {
        if (c === null || c === undefined) return "";
        const ref = `${colName(i)}${r + 1}`;
        if (typeof c === "string") return shared ? `<c r="${ref}" t="s"><v>${si(c)}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`;
        if (typeof c === "number") return `<c r="${ref}"><v>${c}</v></c>`;
        if (c.date !== undefined) return `<c r="${ref}" s="1"><v>${c.date}</v></c>`;
        if (c.f !== undefined) return `<c r="${ref}"${typeof c.v === "string" ? ' t="str"' : ""}><f>${esc(c.f)}</f>${c.v === undefined ? "" : `<v>${esc(c.v)}</v>`}</c>`;
        if (c.err) return `<c r="${ref}" t="e"><v>${esc(c.err)}</v></c>`;
        if (c.bool !== undefined) return `<c r="${ref}" t="b"><v>${c.bool ? 1 : 0}</v></c>`;
        return "";
      }).join("");
      return `<row r="${r + 1}">${cells}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>${doctype ? '<!DOCTYPE x [<!ENTITY a "aaaa">]>' : ""}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };
  const sheetFiles = sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows) }));
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml${macros ? "" : ""}"/>${macros ? '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>' : ""}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${hiddenSheets.includes(s.name) ? ' state="hidden"' : ""} r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>` },
    ...sheetFiles,
  ];
  if (shared) files.push({ name: "xl/sharedStrings.xml", data: `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>` });
  if (macros) files.push({ name: "xl/vbaProject.bin", data: "x" });
  return zip([...files, ...extraFiles]);
}

// ---- a reduced, anonymised version of the real Torquen template -----------------
export const CAL_HEAD = ["Fecha", "Día", "Semana", "Formato", "Cód.", "Título / Idea", "Pilar", "CTA"];
export const DET_HEAD = ["Cód.", "Título", "Descripción / enfoque", "Pilar", "CTA"];

export function torquenRows() {
  return {
    cal: [
      CAL_HEAD,
      [{ date: serial("2026-11-06") }, "Vie", "Semana 1", "Reel", "R1", "Camión modelo A: lo manejás con licencia de auto", "Producto", "Escribinos por WhatsApp"],
      [{ date: serial("2026-11-06") }, "Vie", "Semana 1", "Historia", "H1", "Repost R1 + encuesta", "Interacción", "Encuesta"],
      [{ date: serial("2026-11-07") }, "Sáb", "Semana 1", "Carrusel", "G1", "La gama completa", "Producto", "Guardá y escribinos"],
      [{ date: serial("2026-11-09") }, "Lun", "Semana 2", "Pieza única", "G2", "Black Friday: consultá por tu próximo camión", "Conversión", "WhatsApp"],
      [{ date: serial("2026-11-10") }, "Mar", "Semana 2", "Reel", "R2", "Cómo elegir según tu carga", "Educación", "Contanos tu carga"],
      [{ date: serial("2026-11-10") }, "Mar", "Semana 2", "Historia", "H2", "Quiz de pallets", "Interacción", "Quiz sticker"],
    ],
    reels: [DET_HEAD, ["R1", "Camión modelo A", "Hook: te presento el modelo A.", "Producto", "Escribinos por WhatsApp"], ["R2", "Elegir por carga", "Hook: ¿cuánta carga movés?", "Educación", "Contanos tu carga"]],
    carr: [DET_HEAD, ["G1", "La gama", "Carrusel · 9 slides.", "Producto", "Guardá y escribinos"], ["G2", "Black Friday", "Pieza única 1080x1350.", "Conversión", "WhatsApp"]],
    hist: [["Cód.", "Título", "Descripción / enfoque", "Pilar", "Formato/CTA"], ["H1", "Repost + encuesta", "Repost del reel con encuesta.", "Interacción", "Encuesta"], ["H2", "Quiz pallets", "Opciones: 3 / 6 / 9.", "Interacción", "Quiz sticker"]],
    notes: [["Tema", "Detalle"], ["Período", "Del viernes 6 al lunes 30 de noviembre de 2026."], ["Días de trabajo", "No se programa contenido los domingos (8, 15, 22 y 29)."],
      ["Black Friday", "Viernes 27/11. La pieza G2 queda sujeta a beneficios confirmados."], ["Regla del proyecto", "Solo fotografías y logos oficiales."]],
  };
}

export function torquenXlsx(over = {}) {
  const t = { ...torquenRows(), ...(over.rows || {}) };
  const order = over.order || ["Calendario", "Reels", "Carruseles", "Historias", "Notas"];
  const by = { Calendario: t.cal, Reels: t.reels, Carruseles: t.carr, Historias: t.hist, Notas: t.notes };
  return makeXlsx({ sheets: order.filter((n) => by[n]).map((n) => ({ name: n, rows: by[n] })), shared: over.shared, extraFiles: over.extraFiles });
}
