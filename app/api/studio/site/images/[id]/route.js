import { guardApi } from "@/lib/studio/server/auth";
import { deleteBlob } from "@/lib/studio/server/blob";
import { deleteImage } from "@/lib/studio/server/siteHome";

export const runtime = "nodejs";

export async function DELETE(_req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const r = await deleteImage(params.id);
  if (r.status === "missing") return Response.json({ error: "No encontrada" }, { status: 404 });
  if (r.status === "in-use") {
    return Response.json({ error: "La imagen está en uso en el Inicio. Quitala de ahí primero." }, { status: 409 });
  }
  await deleteBlob(r.image.url).catch(() => {});
  return Response.json({ ok: true });
}
