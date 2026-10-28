import PageHeader from "@/components/PageHeader";
import ReferenceForm from "@/components/ReferenceForm";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Referencias — Stroka Visual",
  description: "Dejá tu comentario sobre tu experiencia trabajando con Stroka Visual.",
  robots: { index: false, follow: true },
};

export default function ReferenciasPage() {
  return (
    <>
      <PageHeader
        eyebrow="Referencias"
        title="Tu experiencia"
        intro="Contanos cómo fue trabajar con Stroka. Revisamos cada comentario antes de publicarlo."
      />
      <section className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <div className="max-w-xl">
          <Reveal>
            <ReferenceForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
