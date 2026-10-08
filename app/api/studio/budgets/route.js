import { guardApi } from "@/lib/studio/server/auth";
import { createBudget, listBudgets } from "@/lib/studio/server/budgets";
import { validateBudget } from "@/lib/studio/validate";

export const runtime = "nodejs";

export async function GET(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q") || "";
  return Response.json({ budgets: await listBudgets(q) });
}

export async function POST(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const { errors, data } = validateBudget(await req.json().catch(() => null));
  if (errors.length) return Response.json({ errors }, { status: 400 });
  return Response.json({ budget: await createBudget(data) }, { status: 201 });
}
