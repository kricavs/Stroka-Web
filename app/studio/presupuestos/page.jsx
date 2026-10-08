import Link from "next/link";
import { requireSession } from "@/lib/studio/server/auth";
import { listBudgets } from "@/lib/studio/server/budgets";
import BudgetList from "@/components/studio/BudgetList";

export default async function BudgetsPage({ searchParams }) {
  await requireSession();
  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const budgets = await listBudgets(q);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wider3 text-champagne">Historial</p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-wider2">PRESUPUESTOS</h1>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/studio/export"
            className="border border-bone/25 px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 hover:border-champagne hover:text-champagne"
          >
            Exportar backup
          </a>
          <Link
            href="/studio/presupuestos/nuevo"
            className="bg-bone px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 text-ink hover:bg-champagne"
          >
            Nuevo presupuesto
          </Link>
        </div>
      </div>
      <form className="mt-8 max-w-md" action="/studio/presupuestos">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente, proyecto o número…"
          className="w-full border border-bone/15 bg-transparent px-3 py-2.5 text-sm placeholder:text-ash/60 focus:border-champagne focus:outline-none"
        />
      </form>
      <BudgetList initial={budgets} />
    </>
  );
}
