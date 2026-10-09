import Link from "next/link";
import "./studio.css";
import { Logo } from "@/components/Logo";
import { hasSession } from "@/lib/studio/server/auth";
import LogoutButton from "@/components/studio/LogoutButton";

export const metadata = {
  title: "Stroka Studio",
  description: "Herramienta interna privada.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Private shell: no public navbar/footer, always dynamic (reads the session).
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }) {
  const authed = await hasSession();
  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="border-b border-edge">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 md:px-8">
          <Link href="/studio/presupuestos" className="flex items-center gap-4">
            <Logo className="h-7 w-auto" />
            <span className="hidden h-5 w-px bg-edge sm:inline-block" />
            <span className="hidden text-[0.62rem] font-light uppercase tracking-wider3 text-champagne sm:inline">Studio</span>
          </Link>
          {authed && (
            <nav className="flex items-center gap-5 sm:gap-6 text-[0.68rem] font-light uppercase tracking-wider2 text-ash">
              <Link href="/studio/presupuestos" className="hover:text-champagne">Presupuestos</Link>
              <LogoutButton />
            </nav>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
