import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import LoginForm from "@/components/portal/LoginForm";
import { getClientScope } from "@/lib/portal/server/scope";

export default async function PortalLogin() {
  if (await getClientScope()) redirect("/portal/resumen");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo className="h-7 w-auto self-start" />
      <p className="mt-14 text-[0.7rem] font-light uppercase tracking-[0.3em] text-[#b9a388]">Acceso privado</p>
      <h1 className="mt-3 font-title text-5xl uppercase leading-[0.98] tracking-wide sm:text-6xl">
        Portal de<br />clientes
      </h1>
      <span className="mt-5 block h-px w-10 bg-[#b9a388]" />
      <LoginForm />
    </main>
  );
}
