import Link from "next/link";
import { SITE } from "@/lib/site";
import { Logo } from "@/components/Logo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t hairline bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <div>
            <Logo className="h-10 w-auto md:h-12" />
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-ash">
              Contenido que conecta. Imágenes que venden.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-wider2 text-ash transition-colors hover:text-bone"
            >
              Instagram — @{SITE.instagram}
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="uppercase tracking-wider2 text-ash transition-colors hover:text-bone"
            >
              {SITE.email}
            </a>
            <a
              href={SITE.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="uppercase tracking-wider2 text-ash transition-colors hover:text-bone"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t hairline pt-8 text-xs uppercase tracking-wider2 text-ash/70 md:flex-row md:items-center md:justify-between">
          <span>© {year} Stroka Visual</span>
          <Link href="/contacto" className="hover:text-bone">
            Trabajemos juntos
          </Link>
        </div>
      </div>
    </footer>
  );
}
