import { notFound } from "next/navigation";
import { getProfile } from "@/lib/portal/server/content";
import Archivos from "./Archivos";
import Calendario from "./Calendario";
import Contenido from "./Contenido";
import Pendientes from "./Pendientes";
import PortalShell from "./PortalShell";
import Resumen from "./Resumen";

// One renderer for the real portal (/portal/*) and Studio's read-only
// "ver como cliente" (/studio/ver/[id]/*): same UI, different scope + base.
export default async function renderPortal({ scope, base, slug = ["resumen"], searchParams, preview }) {
  // Real clients download through the portal API; the admin preview goes through Studio's (portal cookie absent).
  const fileHref = (id) => (scope.source === "session" ? `/api/portal/files/${id}` : `/api/studio/files/${id}`);
  const [section, arg, ...rest] = slug;
  const ok =
    rest.length === 0 &&
    ((["resumen", "calendario", "pendientes", "archivos"].includes(section) && arg === undefined) ||
      (section === "contenido" && typeof arg === "string"));
  if (!ok) notFound();

  const profile = await getProfile(scope);
  if (!profile) notFound();

  let body;
  if (section === "resumen") body = <Resumen scope={scope} base={base} />;
  else if (section === "calendario") body = <Calendario scope={scope} base={base} searchParams={searchParams} />;
  else if (section === "contenido") body = <Contenido scope={scope} base={base} id={arg} fileHref={fileHref} />;
  else if (section === "pendientes") body = <Pendientes scope={scope} base={base} />;
  else body = <Archivos scope={scope} fileHref={fileHref} />;

  return (
    <PortalShell profile={profile} base={base} preview={preview} identity={{ name: scope.displayName }}>
      {body}
    </PortalShell>
  );
}
