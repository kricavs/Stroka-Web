import Link from "next/link";
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
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 md:px-8">
          <Link href="/studio/presupuestos" className="flex items-baseline gap-3">
            <span className="font-display text-sm font-semibold tracking-[0.3em]">STROKA</span>
            <span className="text-[0.62rem] uppercase tracking-wider3 text-champagne">Studio</span>
          </Link>
          {authed && (
            <nav className="flex items-center gap-6 text-[0.68rem] uppercase tracking-wider2 text-ash">
              <Link href="/studio/presupuestos" className="hover:text-bone">Presupuestos</Link>
              <LogoutButton />
            </nav>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
