import { redirect } from "next/navigation";
import { hasSession } from "@/lib/studio/server/auth";
import LoginForm from "@/components/studio/LoginForm";

export default async function LoginPage() {
  if (await hasSession()) redirect("/studio/presupuestos");
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <p className="text-[0.65rem] uppercase tracking-wider3 text-champagne">Acceso privado</p>
      <h1 className="mt-3 font-display text-4xl font-light tracking-wider2">INGRESAR</h1>
      <LoginForm />
    </div>
  );
}
