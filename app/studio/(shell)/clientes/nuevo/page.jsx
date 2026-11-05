import PageHead from "@/components/studio/PageHead";
import ClientForm from "@/components/studio/ClientForm";
import { requireSession } from "@/lib/studio/server/auth";

export default async function NewClientPage() {
  await requireSession();
  return (
    <>
      <PageHead eyebrow="Clientes" title="Nuevo cliente" />
      <ClientForm />
    </>
  );
}
