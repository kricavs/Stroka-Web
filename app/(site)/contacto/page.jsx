import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import Reveal from "@/components/Reveal";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Contacto — Stroka Visual",
  description: "Contactá a Stroka Visual. Instagram, WhatsApp y email.",
};

export default function ContactoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contacto"
        title="Hablemos"
        intro="Contanos qué tenés en mente. Respondemos a la brevedad."
      />

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 pb-32 md:grid-cols-12 md:px-10">
        <div className="md:col-span-7">
          <Reveal>
            <ContactForm />
          </Reveal>
        </div>

        <div className="md:col-span-4 md:col-start-9">
          <Reveal delay={120}>
            <p className="mb-8 text-[0.7rem] uppercase tracking-wider3 text-ash">
              Directo
            </p>
            <ul className="space-y-6">
              <li>
                <a
                  href={SITE.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="block text-[0.65rem] uppercase tracking-wider2 text-ash">
                    Instagram
                  </span>
                  <span className="font-display text-xl text-bone transition-colors group-hover:text-ash">
                    @{SITE.instagram}
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${SITE.email}`} className="group block">
                  <span className="block text-[0.65rem] uppercase tracking-wider2 text-ash">
                    Email
                  </span>
                  <span className="font-display text-xl text-bone transition-colors group-hover:text-ash">
                    {SITE.email}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={SITE.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="block text-[0.65rem] uppercase tracking-wider2 text-ash">
                    WhatsApp
                  </span>
                  <span className="font-display text-xl text-bone transition-colors group-hover:text-ash">
                    Escribinos
                  </span>
                </a>
              </li>
            </ul>
          </Reveal>
        </div>
      </section>
    </>
  );
}
