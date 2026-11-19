// Builds the MCP server for ONE authenticated request (stateless: a fresh
// instance per HTTP request, nothing kept in memory between requests).
import { McpServer } from "@modelcontextprotocol/server";
import { McpError } from "./errors.js";
import { schemas } from "./schemas.js";
import * as tools from "./tools-core.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ADD = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const EDIT = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  ["get_client", "Datos operativos del cliente", "Nombre, objetivo mensual, estado y zona horaria del cliente de este proyecto.", READ, tools.getClient],
  ["get_calendar", "Calendario del mes", "Contenidos del mes (id, version, fecha, hora, título, tipo, plataforma, estado, pillar, cta). Horas en Buenos Aires.", READ, tools.getCalendar],
  ["get_content", "Detalle de un contenido", "Un contenido completo (incluye version, necesaria para update_content).", READ, tools.getContent],
  ["get_pending", "Pendientes", "Tareas abiertas, contenidos en revisión del cliente, con cambios solicitados y próximos contenidos.", READ, tools.getPending],
  ["create_content", "Crear contenido", "Crea un contenido en idea o production. Nunca lo aprueba, programa ni envía al cliente. scheduled_at es hora de Buenos Aires.", ADD, tools.createContent],
  ["update_content", "Modificar contenido", "Modifica campos de un contenido. Requiere expected_version (la leída); si cambió, devuelve CONFLICT y hay que releer. Cambiar algo visible de un contenido aprobado reabre su aprobación.", EDIT, tools.updateContent],
  ["create_task", "Crear tarea", "Crea una tarea para este cliente.", ADD, tools.createTask],
  ["update_task", "Modificar tarea", "Modifica título, descripción, fecha límite, prioridad o estado de una tarea de este cliente.", EDIT, tools.updateTask],
];

function result(payload, isError = false) {
  const body = isError ? { error: payload } : payload;
  return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, isError };
}

export function createMcpServer({ db, scope, now, onUnexpected = () => {} }) {
  const server = new McpServer({ name: "stroka-studio", version: "1.0.0" }, {
    instructions:
      "Stroka Studio es la fuente de verdad del calendario y las tareas de UN cliente (el de este acceso). " +
      "Leé antes de escribir. Para modificar un contenido usá la version que leíste; si hay CONFLICT, releé. " +
      "Las fechas son hora de Buenos Aires (YYYY-MM-DDTHH:mm). No se puede aprobar, programar, publicar ni borrar.",
  });
  for (const [name, title, description, annotations, fn] of TOOLS) {
    server.registerTool(name, { title, description, inputSchema: schemas[name], annotations }, async (args) => {
      try {
        return result(await fn(db, scope, args, { now }));
      } catch (err) {
        const mapped = tools.toMcpError(err);
        if (mapped) return result(mapped.toJSON(), true);
        onUnexpected(err, name);
        return result(new McpError("INVALID_INPUT", "Error interno al procesar la solicitud.").toJSON(), true);
      }
    });
  }
  return server;
}
