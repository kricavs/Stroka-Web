import { STATUSES } from "@/lib/studio/config";
import { guardApi } from "@/lib/studio/server/auth";
import { setStatus } from "@/lib/studio/server/budgets";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const { status } = (await req.json().catch(() => ({}))) || {};
  if (!STATUSES.includes(status)) return Response.json({ error: "Estado inválido" }, { status: 400 });
  return (await setStatus(params.id, status))
    ? Response.json({ ok: true })
    : Response.json({ error: "No encontrado" }, { status: 404 });
}
