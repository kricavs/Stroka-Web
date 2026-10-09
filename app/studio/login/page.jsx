import { redirect } from "next/navigation";
import { hasSession } from "@/lib/studio/server/auth";
import LoginForm from "@/components/studio/LoginForm";

export default async function LoginPage() {
  if (await hasSession()) redirect("/studio/presupuestos");
  return (
    <div className="mx-auto mt-12 max-w-sm">
      <p className="text-[0.7rem] font-light uppercase tracking-[0.3em] text-champagne">Acceso privado</p>
      <h1 className="mt-3 font-title text-7xl uppercase leading-[0.95] tracking-wide">Stroka<br />Studio</h1>
      <span className="mt-5 block h-px w-10 bg-champagne" />
      <LoginForm />
    </div>
  );
}
