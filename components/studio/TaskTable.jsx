import Link from "next/link";
import TaskStatusButtons from "./TaskStatusButtons";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/shared/content.js";
import { formatDayShort } from "@/lib/shared/time.js";

export default function TaskTable({ tasks, today, showClient = true }) {
  if (!tasks.length) return <p className="text-sm font-light text-ash">No hay tareas con estos filtros.</p>;
  return (
    <div className="overflow-x-auto border border-edge">
      <table className="w-full min-w-[48rem] text-left text-sm font-light">
        <thead className="border-b border-edge bg-panel text-[0.6rem] uppercase tracking-wider2 text-ash">
          <tr><th className="px-4 py-3">Tarea</th>{showClient && <th className="px-4 py-3">Cliente</th>}<th className="px-4 py-3">Vence</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" /></tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {tasks.map((t) => {
            const open = t.status === "pending" || t.status === "in_progress";
            const late = open && t.due && t.due < today;
            return (
              <tr key={t.id} className={open ? "" : "opacity-50"}>
                <td className="px-4 py-3">
                  <Link href={`/studio/tareas/${t.id}`} className="hover:text-champagne">{t.title}</Link>
                  {t.visibility === "client" && <span className="ml-2 text-[0.58rem] uppercase tracking-wider2 text-champagne">Cliente</span>}
                  {t.kind === "change_request" && <span className="ml-2 text-[0.58rem] uppercase tracking-wider2 text-[#e0a35f]">Cambios</span>}
                  {t.content_title && <Link href={`/studio/contenido/${t.content_id}`} className="block text-xs text-ash hover:text-champagne">{t.content_title}</Link>}
                </td>
                {showClient && <td className="px-4 py-3">{t.client_name || "—"}</td>}
                <td className={`px-4 py-3 ${late ? "text-[#e28a80]" : ""}`}>{t.due ? formatDayShort(new Date(`${t.due}T15:00:00Z`)) : "—"}{late ? " · vencida" : ""}</td>
                <td className="px-4 py-3">{TASK_PRIORITY_LABEL[t.priority]}</td>
                <td className="px-4 py-3">{TASK_STATUS_LABEL[t.status]}{t.completed_by ? ` · ${t.completed_by}` : ""}</td>
                <td className="px-4 py-3 text-right"><TaskStatusButtons id={t.id} status={t.status} compact /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
