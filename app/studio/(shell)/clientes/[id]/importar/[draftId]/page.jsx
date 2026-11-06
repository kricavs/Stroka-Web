import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/studio/PageHead";
import PlannerReview from "@/components/studio/planner/PlannerReview";
import { requireSession } from "@/lib/studio/server/auth";
import { getPlanningDraft } from "@/lib/studio/server/planner";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }) {
  await requireSession();
  let draft;
  try {
    draft = await getPlanningDraft(params.id, params.draftId);
  } catch (e) {
    if (e?.status === 404) notFound();
    throw e;
  }
  return (
    <>
      <PageHead eyebrow={draft.clientName} title="Revisar planificación">
        <Link href={`/studio/clientes/${params.id}?tab=calendario`} className="border border-[#55524d] px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne">Calendario</Link>
      </PageHead>
      <PlannerReview draft={JSON.parse(JSON.stringify(draft))} clientId={params.id} />
    </>
  );
}
