import { requireSession } from "@/lib/studio/server/auth";
import BudgetEditor from "@/components/studio/BudgetEditor";

export default async function NewBudgetPage() {
  await requireSession();
  return <BudgetEditor initial={null} />;
}
