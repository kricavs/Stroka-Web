// Input schemas for the MCP tools. All objects are STRICT: unknown keys (a
// `client_id` smuggled in by a prompt, an unlisted patch field…) are rejected,
// never silently ignored.
import * as z from "zod";
import { CONTENT_TYPES, PLATFORMS, TASK_PRIORITIES, TASK_STATUSES, TASK_VISIBILITIES } from "../shared/content.js";
import { MCP_CREATE_STATUSES, MCP_STATUS_TARGETS } from "./tools-core.js";

const keys = (list) => list.map(([k]) => k);
const type = z.enum(keys(CONTENT_TYPES));
const platform = z.enum(keys(PLATFORMS));
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usá el formato YYYY-MM, por ejemplo 2026-11");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Usá YYYY-MM-DDTHH:mm en hora de Buenos Aires, por ejemplo 2026-11-18T18:00");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usá YYYY-MM-DD");
const id = z.string().min(1).max(64);
const CLIENT_NOTES = "ATENCIÓN: notas que pueden ser VISIBLES PARA EL CLIENTE en su portal. No escribas aquí nada interno.";
const strict = (shape) => z.strictObject(shape);

export const schemas = {
  get_client: strict({}),
  get_calendar: strict({ month: month.describe("Mes a consultar, YYYY-MM") }),
  get_content: strict({ content_id: id }),
  get_pending: strict({}),
  create_content: strict({
    title: z.string().min(1).max(200),
    scheduled_at: localDateTime.describe("Fecha y hora local de Buenos Aires: YYYY-MM-DDTHH:mm"),
    type, platform,
    pillar: z.string().max(120).optional(),
    cta: z.string().max(300).optional(),
    copy: z.string().max(8000).optional().describe("Texto/copy de la pieza (opcional)"),
    client_notes: z.string().max(2000).optional().describe(CLIENT_NOTES),
    status: z.enum(MCP_CREATE_STATUSES).optional().describe("idea o production (por defecto production)"),
  }),
  update_content: strict({
    content_id: id,
    expected_version: z.number().int().min(1).describe("La version que leíste con get_content/get_calendar"),
    patch: strict({
      title: z.string().min(1).max(200).optional(),
      scheduled_at: localDateTime.nullable().optional(),
      type: type.optional(),
      platform: platform.optional(),
      pillar: z.string().max(120).nullable().optional(),
      cta: z.string().max(300).nullable().optional(),
      copy: z.string().max(8000).nullable().optional().describe("Texto/copy de la pieza. Si el contenido estaba aprobado, reabre su aprobación."),
      client_notes: z.string().max(2000).nullable().optional().describe(CLIENT_NOTES),
      status: z.enum(MCP_STATUS_TARGETS).optional().describe("Solo idea, production, review o cancelled"),
    }).refine((p) => Object.keys(p).length > 0, "El patch no puede estar vacío"),
  }),
  create_task: strict({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    due_date: date.optional(),
    priority: z.enum(keys(TASK_PRIORITIES)).optional(),
    visibility: z.enum(keys(TASK_VISIBILITIES)).optional(),
    content_id: id.optional(),
  }),
  update_task: strict({
    task_id: id,
    patch: strict({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(4000).nullable().optional(),
      due_date: date.nullable().optional(),
      priority: z.enum(keys(TASK_PRIORITIES)).optional(),
      status: z.enum(keys(TASK_STATUSES)).optional(),
    }).refine((p) => Object.keys(p).length > 0, "El patch no puede estar vacío"),
  }),
};
