import { guardApi } from "@/lib/studio/server/auth";
import { deleteBudget, getBudget, updateBudget } from "@/lib/studio/server/budgets";
import { validateBudget } from "@/lib/studio/validate";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const budget = await getBudget(params.id);
  return budget ? Response.json({ budget }) : Response.json({ error: "No encontrado" }, { status: 404 });
}

export async function PUT(req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const { errors, data } = validateBudget(await req.json().catch(() => null));
  if (errors.length) return Response.json({ errors }, { status: 400 });
  const budget = await updateBudget(params.id, data);
  return budget ? Response.json({ budget }) : Response.json({ error: "No encontrado" }, { status: 404 });
}

export async function DELETE(_req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  return (await deleteBudget(params.id))
    ? Response.json({ ok: true })
    : Response.json({ error: "No encontrado" }, { status: 404 });
}
