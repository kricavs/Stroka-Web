import "server-only";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { InputError } from "../errors.js";
import { MAX_XLSX_BYTES } from "../../planner/limits.js";
import { parsePlanningWorkbook } from "../../planner/parser.js";
import { createPlanningDraft } from "./planner";

// Excel → draft. The file lives only in memory for this call: it is parsed,
// hashed (SHA-256) and dropped. Nothing is written to disk or Blob.
export async function importWorkbook({ clientId, file, platform, status, time }) {
  if (!file || typeof file.arrayBuffer !== "function") throw new InputError("Elegí un archivo .xlsx.");
  const name = basename(String(file.name || "planificacion.xlsx")).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
  if (!/\.xlsx$/i.test(name)) throw new InputError("Solo se aceptan archivos .xlsx (no .xls, .xlsm ni CSV).");
  if (file.size > MAX_XLSX_BYTES) throw new InputError(`El archivo supera el máximo de ${MAX_XLSX_BYTES / 1024 / 1024} MB.`, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parsePlanningWorkbook(bytes);
  return createPlanningDraft({
    sourceType: "xlsx", clientId, items: parsed.items, notes: parsed.notes, issues: parsed.issues, sourceName: name,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    defaultPlatform: platform, defaultContentStatus: status || undefined, defaultTime: time || undefined,
  });
}
