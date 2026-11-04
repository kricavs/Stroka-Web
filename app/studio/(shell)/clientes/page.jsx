import Link from "next/link";
import PageHead from "@/components/studio/PageHead";
import ToggleActive from "@/components/studio/ToggleActive";
import { requireSession } from "@/lib/studio/server/auth";
import { listClients } from "@/lib/studio/server/clients";
import { formatDayShort, formatStamp, monthKey, monthRange } from "@/lib/shared/time.js";

export default async function ClientsPage() {
  await requireSession();
  const now = new Date();
  const month = monthKey(now);
  const mr = monthRange(month);
  const rows = await listClients({ month, monthStart: mr.start, monthEnd: mr.end, now });

  return (
    <>
      <PageHead eyebrow="Operación" title="Clientes">
        <Link href="/studio/clientes/nuevo" className="bg-champagne px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-ink hover:bg-bone">Nuevo cliente</Link>
      </PageHead>
      {rows.length === 0 ? (
        <p className="text-sm font-light text-ash">Todavía no hay clientes. Creá el primero.</p>
      ) : (
        <div className="overflow-x-auto border border-edge">
          <table className="w-full min-w-[46rem] text-left text-sm font-light">
            <thead className="border-b border-edge bg-panel text-[0.6rem] uppercase tracking-wider2 text-ash">
              <tr>
                <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Próxima publicación</th>
                <th className="px-4 py-3">Mes</th><th className="px-4 py-3">Pendientes</th>
                <th className="px-4 py-3">Último acceso</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {rows.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <Link href={`/studio/clientes/${c.id}`} className="hover:text-champagne">{c.name}</Link>
                    {!c.active && <span className="ml-2 text-[0.6rem] uppercase tracking-wider2 text-ash">Inactivo</span>}
                    {c.active && !c.has_code && <span className="ml-2 text-[0.6rem] uppercase tracking-wider2 text-[#e0a35f]">Sin acceso</span>}
                  </td>
                  <td className="px-4 py-3">{c.next_at ? formatDayShort(new Date(c.next_at)) : "—"}</td>
                  <td className="px-4 py-3">{c.month_count} · {c.month_published}/{c.contracted || "—"} publ.</td>
                  <td className="px-4 py-3">{c.pending > 0 ? `${c.pending} en revisión` : "—"}</td>
                  <td className="px-4 py-3">{c.last_login_at ? formatStamp(new Date(c.last_login_at)) : "Nunca"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex gap-2">
                      <Link href={`/studio/clientes/${c.id}`} className="border border-[#55524d] px-3 py-1.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Abrir</Link>
                      <ToggleActive id={c.id} active={c.active} compact />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
