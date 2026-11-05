import "./portal.css";
export const metadata = {
  title: "Portal de clientes · Stroka",
  description: "Acceso privado para clientes de Stroka.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Private, per-request (reads the session cookie).
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }) {
  return <div className="min-h-screen bg-[#16161a] text-[#ecebe8]">{children}</div>;
}
