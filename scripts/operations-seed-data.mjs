// Fake scenarios ("Demo …") for the Studio dashboard. Pure data/logic: it knows
// NOTHING about where the database is. Callers are responsible for the safety
// checks (see seed-dev-operations.mjs: localhost only).
import * as clients from "../lib/studio/clients-core.js";
import * as contentCore from "../lib/studio/content-core.js";
import * as tasks from "../lib/studio/tasks-core.js";
import * as actions from "../lib/portal/actions-core.js";
import { mintScope } from "../lib/portal/scope-core.js";
import { addDays, monthKey, ymd, zonedTimeToUtc, parseYmd } from "../lib/shared/time.js";

export async function seedOperations(db) {
  const now = new Date();
  const today = ymd(now);
  const month = monthKey(now);
  // Business-zone wall clock → UTC instant, offset by whole days from today.
  const slot = (offsetDays, hour = 18, minute = 0) => {
    const p = parseYmd(addDays(today, offsetDays));
    return zonedTimeToUtc({ ...p, hour, minute });
  };
  const inMonth = (day, hour = 12) => zonedTimeToUtc({ ...parseYmd(`${month}-${String(day).padStart(2, "0")}`), hour, minute: 0 });

  async function content(clientId, title, { status = "production", at = null, sentDaysAgo = null, type = "reel" } = {}) {
    const id = await contentCore.createContent(db, clientId, { title, platform: "instagram", contentType: type, scheduledLocal: "" });
    await db.query(
      `UPDATE content_items SET status = $2, scheduled_at = $3, sent_to_client_at = $4 WHERE id = $1`,
      [id, status, at, sentDaysAgo === null ? null : new Date(now.getTime() - sentDaysAgo * 86400000)]
    );
    return id;
  }
  const session = async (clientId, name) => {
    const sid = `ses_${clientId.slice(-6)}`;
    await db.query(`INSERT INTO client_sessions (id, client_id, token_hash, display_name, expires_at) VALUES ($1,$2,$3,$4, now() + interval '1 day')`, [sid, clientId, sid, name]);
    return mintScope({ clientId, source: "session", sessionId: sid, displayName: name });
  };

  // A — Al día: goal met, everything near is approved.
  const A = await clients.createClient(db, { name: "Demo Aurora", monthly: 4 });
  await content(A, "Lanzamiento colección", { status: "published", at: inMonth(2) });
  await content(A, "Carrusel temporada", { status: "approved", at: slot(4) });
  await content(A, "Reel detrás de escena", { status: "scheduled", at: slot(6, 12) });
  await content(A, "Post cierre de mes", { status: "approved", at: slot(15) });
  await tasks.createTask(db, { title: "Preparar reporte de cierre", clientId: A, dueDate: addDays(today, 5) });

  // B — Ritmo bajo / atrasado: big goal, almost nothing planned.
  const B = await clients.createClient(db, { name: "Demo Brisa", monthly: 30 });
  await content(B, "Reel único del mes", { status: "production", at: slot(12) });
  await content(B, "Historia sin fecha", { status: "production" });
  await content(B, "Otra historia sin fecha", { status: "review" });

  // C — Cambios solicitados por el cliente (real flow: comment + approval row + automatic task).
  const C = await clients.createClient(db, { name: "Demo Cobalto", monthly: 6 });
  const c1 = await content(C, "Spot institucional", { status: "client_review", at: slot(10), sentDaysAgo: 2 });
  await content(C, "Post aniversario", { status: "approved", at: slot(8) });
  const [{ version }] = await db.query(`SELECT version FROM content_items WHERE id = $1`, [c1]);
  await actions.requestChanges(db, await session(C, "María Gómez"), { contentId: c1, version, body: "Cambiar el color del fondo y acortar el copy.", name: "María Gómez" });

  // D — Publicación en riesgo: mañana 18:00, todavía en revisión del cliente hace 4 días + tarea urgente vencida.
  const D = await clients.createClient(db, { name: "Demo Delta", monthly: 5 });
  await content(D, "Reel lanzamiento", { status: "client_review", at: slot(1), sentDaysAgo: 4 });
  await content(D, "Post de producto", { status: "approved", at: slot(5) });
  await content(D, "Carrusel educativo", { status: "client_review", at: slot(9), sentDaysAgo: 1, type: "carousel" });
  await tasks.createTask(db, { title: "Seleccionar fotos", clientId: D, dueDate: addDays(today, -2), priority: "urgent" });
  await tasks.createTask(db, { title: "Armar brief de próxima campaña", clientId: D, dueDate: today });

  // E — Sin objetivo configurado.
  const E = await clients.createClient(db, { name: "Demo Eco", monthly: 0 });
  await content(E, "Nota institucional", { status: "production", at: slot(6), type: "article" });
  await content(E, "Idea para el blog", { status: "idea" });
  await tasks.createTask(db, { title: "Llamar para definir plan del mes", clientId: E, dueDate: addDays(today, 3) });
  await tasks.createTask(db, { title: "Ordenar archivos de marca" });

  // F — Inactive: must NOT appear anywhere on the dashboard.
  const F = await clients.createClient(db, { name: "Demo Inactivo", monthly: 8 });
  await content(F, "No debería verse", { status: "client_review", at: slot(1), sentDaysAgo: 9 });
  await tasks.createTask(db, { title: "Tarea de cliente inactivo", clientId: F, dueDate: addDays(today, -5), priority: "urgent" });
  await clients.setActive(db, F, false);

  await tasks.createTask(db, { title: "Renovar dominio (sin cliente)", dueDate: addDays(today, 2) });
}
