import { revalidatePath } from "next/cache";
import { guardApi } from "@/lib/studio/server/auth";
import { deleteTestimonial, setStatus } from "@/lib/studio/server/testimonials";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const { status } = (await req.json().catch(() => null)) || {};
  if (!(await setStatus(params.id, status))) {
    return Response.json({ error: "No encontrada o estado inválido" }, { status: 404 });
  }
  revalidatePath("/");
  return Response.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  if (!(await deleteTestimonial(params.id))) return Response.json({ error: "No encontrada" }, { status: 404 });
  revalidatePath("/");
  return Response.json({ ok: true });
}
