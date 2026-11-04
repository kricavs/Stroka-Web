import { requireClient } from "@/lib/portal/server/scope";
import renderPortal from "@/components/portal/PortalPages";

export default async function PortalPage({ params, searchParams }) {
  const scope = await requireClient();
  return renderPortal({ scope, base: "/portal", slug: params.slug, searchParams });
}
