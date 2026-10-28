import { revalidatePath } from "next/cache";
import { guardApi } from "@/lib/studio/server/auth";
import { reorderPublished } from "@/lib/studio/server/testimonials";

export const runtime = "nodejs";

export async function POST(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const { ids } = (await req.json().catch(() => null)) || {};
  if (!Array.isArray(ids) || ids.length > 200) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  await reorderPublished(ids.map(String));
  revalidatePath("/");
  return Response.json({ ok: true });
}
