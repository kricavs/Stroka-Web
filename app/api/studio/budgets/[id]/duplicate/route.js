import { todayISO } from "@/lib/studio/calc";
import { guardApi } from "@/lib/studio/server/auth";
import { duplicateBudget } from "@/lib/studio/server/budgets";

export const runtime = "nodejs";

export async function POST(_req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const budget = await duplicateBudget(params.id, todayISO());
  return budget ? Response.json({ budget }, { status: 201 }) : Response.json({ error: "No encontrado" }, { status: 404 });
}
