import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/studio/PageHead";
import PlannerUpload from "@/components/studio/planner/PlannerUpload";
import { requireSession } from "@/lib/studio/server/auth";
import { getClient } from "@/lib/studio/server/clients";

export default async function ImportPage({ params }) {
  await requireSession();
  const client = await getClient(params.id);
  if (!client) notFound();
  return (
    <>
      <PageHead eyebrow={client.name} title="Importar planificación">
        <Link href={`/studio/clientes/${client.id}?tab=calendario`} className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Volver al calendario</Link>
      </PageHead>
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-1 text-[0.62rem] uppercase tracking-wider2 text-ash">
        <li className="text-champagne">1 · Archivo</li><li>2 · Revisión</li><li>3 · Aplicar</li>
      </ol>
      <PlannerUpload clientId={client.id} clientName={client.name} />
    </>
  );
}
