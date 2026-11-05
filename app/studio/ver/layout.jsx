import "../../portal/portal.css";

export const metadata = {
  title: "Vista cliente · Stroka Studio",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};
export const dynamic = "force-dynamic";

// "Ver como cliente": the portal UI full screen, outside Studio's shell.
export default function ViewAsClientLayout({ children }) {
  return <div className="min-h-screen bg-[#16161a] text-[#ecebe8]">{children}</div>;
}
