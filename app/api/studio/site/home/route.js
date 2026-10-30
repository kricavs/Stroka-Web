import { revalidatePath } from "next/cache";
import { guardApi } from "@/lib/studio/server/auth";
import { getHomeSlots, saveHomeSlots } from "@/lib/studio/server/siteHome";
import { getProjects } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function GET() {
  const denied = await guardApi();
  if (denied) return denied;
  return Response.json(await getHomeSlots());
}

export async function PUT(req) {
  const denied = await guardApi();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ errors: ["Solicitud inválida."] }, { status: 400 });
  const { errors } = await saveHomeSlots(body, getProjects().map((p) => p.slug));
  if (errors.length) return Response.json({ errors }, { status: 400 });
  revalidatePath("/");
  return Response.json(await getHomeSlots());
}
