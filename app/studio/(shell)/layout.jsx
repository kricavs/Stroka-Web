import Link from "next/link";
import "../studio.css";
import { Logo } from "@/components/Logo";
import { hasSession } from "@/lib/studio/server/auth";
import { countPending } from "@/lib/studio/server/testimonials";
import StudioNav from "@/components/studio/StudioNav";

export const metadata = {
  title: "Stroka Studio",
  description: "Herramienta interna privada.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Private shell: no public navbar/footer, always dynamic (reads the session).
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }) {
  const authed = await hasSession();
  let pending = 0;
  if (authed) {
    try {
      pending = await countPending();
    } catch {}
  }
  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="border-b border-edge">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 md:px-8">
          <Link href="/studio" className="flex items-center gap-4">
            <Logo className="h-7 w-auto" />
            <span className="hidden h-5 w-px bg-edge sm:inline-block" />
            <span className="hidden text-[0.62rem] font-light uppercase tracking-wider3 text-champagne sm:inline">Studio</span>
          </Link>
          {authed && <div className="lg:hidden"><StudioNav pending={pending} variant="mobile" /></div>}
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] gap-10 px-5 py-8 md:px-8">
        {authed && <div className="hidden lg:block"><StudioNav pending={pending} variant="desktop" /></div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
