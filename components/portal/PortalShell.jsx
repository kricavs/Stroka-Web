import Link from "next/link";
import { Logo } from "@/components/Logo";
import PortalLogout from "./PortalLogout";
import PortalNav from "./PortalNav";

// Shared frame for the real portal and for Studio's "ver como cliente".
// `preview` = admin-preview scope: loud banner, no logout, nothing writable.
export default function PortalShell({ profile, base, preview, children }) {
  return (
    <div style={{ "--accent": profile.accent || "#b9a388" }}>
      {preview && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-[#d9a441] px-5 py-2.5 text-[#1a1305]">
          <span className="text-[0.72rem] font-bold uppercase tracking-wider2">Modo vista cliente · Solo lectura</span>
          <Link href={preview.backHref} className="bg-[#1a1305] px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-wider2 text-[#d9a441] hover:bg-black">
            Volver a Studio
          </Link>
        </div>
      )}
      <header className="border-b border-[#2a2a31] bg-[#16161a]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5">
          <Logo className="h-6 w-auto" />
          <div className="flex items-center gap-5">
            <span className="hidden text-xs font-light text-[#9a9aa3] sm:inline">{profile.displayName}</span>
            {!preview && <PortalLogout />}
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-2 pt-2 sm:px-4">
          <PortalNav base={base} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
