import ContentForm from "@/components/studio/ContentForm";
import PageHead from "@/components/studio/PageHead";
import { requireSession } from "@/lib/studio/server/auth";
import { clientOptions } from "@/lib/studio/server/clients";
import { parseYmd } from "@/lib/shared/time.js";

export default async function NewContentPage({ searchParams }) {
  await requireSession();
  const clients = (await clientOptions()).filter((c) => c.active);
  const date = typeof searchParams.date === "string" && parseYmd(searchParams.date) ? searchParams.date : "";
  return (
    <>
      <PageHead eyebrow="Contenido" title="Nuevo contenido" />
      <ContentForm
        clients={clients}
        initial={{
          clientId: typeof searchParams.client === "string" ? searchParams.client : "",
          title: "", platform: "instagram", contentType: "post",
          scheduledLocal: date ? `${date}T10:00` : "",
          copy: "", internalNotes: "", clientNotes: "", assignee: "", previewUrl: "", publishedUrl: "",
        }}
      />
    </>
  );
}
