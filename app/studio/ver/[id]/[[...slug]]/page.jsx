import { notFound } from "next/navigation";
import { requireSession } from "@/lib/studio/server/auth";
import { adminPreviewScope } from "@/lib/studio/server/viewAsClient";
import renderPortal from "@/components/portal/PortalPages";

// "VER COMO CLIENTE": the real portal UI under an admin-preview scope.
export default async function ViewAsClient({ params, searchParams }) {
  await requireSession();
  const scope = await adminPreviewScope(params.id);
  if (!scope) notFound();
  return renderPortal({
    scope,
    base: `/studio/ver/${params.id}`,
    slug: params.slug,
    searchParams,
    preview: { backHref: `/studio/clientes/${params.id}` },
  });
}
