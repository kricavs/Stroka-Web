import Link from "next/link";
import { notFound } from "next/navigation";
import ContentForm from "@/components/studio/ContentForm";
import PageHead from "@/components/studio/PageHead";
import StatusActions from "@/components/studio/StatusActions";
import { requireSession } from "@/lib/studio/server/auth";
import { getContent } from "@/lib/studio/server/content";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/shared/content.js";
import { toLocalInput } from "@/lib/shared/time.js";

export default async function ContentPage({ params }) {
  await requireSession();
  const item = await getContent(params.id);
  if (!item) notFound();
  return (
    <>
      <PageHead eyebrow={item.clientName} title="Contenido">
        <Link href={`/studio/clientes/${item.clientId}?tab=contenidos`} className="text-[0.68rem] uppercase tracking-wider2 text-ash hover:text-champagne">← {item.clientName}</Link>
      </PageHead>
      <div className="mb-8 max-w-3xl space-y-3">
        <p className="flex items-center gap-3 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[item.status] }} />
          <span className="uppercase tracking-wider2">{STATUS_LABEL[item.status]}</span>
          <span className="text-xs text-ash">v{item.version}</span>
        </p>
        <StatusActions id={item.id} status={item.status} />
      </div>
      <ContentForm
        key={`${item.id}-${item.version}-${item.status}`}
        id={item.id}
        clients={[]}
        initial={{ ...item, scheduledLocal: item.scheduledAt ? toLocalInput(new Date(item.scheduledAt)) : "" }}
      />
    </>
  );
}
