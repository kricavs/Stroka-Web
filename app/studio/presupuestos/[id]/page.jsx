import { notFound } from "next/navigation";
import { requireSession } from "@/lib/studio/server/auth";
import { getBudget } from "@/lib/studio/server/budgets";
import BudgetEditor from "@/components/studio/BudgetEditor";

export default async function EditBudgetPage({ params }) {
  await requireSession();
  const budget = await getBudget(params.id);
  if (!budget) notFound();
  return <BudgetEditor initial={JSON.parse(JSON.stringify(budget))} />;
}
