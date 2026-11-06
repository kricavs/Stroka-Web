import { getStorage } from "@/lib/files/server/storage";
import { deliverFile } from "@/lib/files/server/serve";
import { InputError } from "@/lib/studio/errors.js";
import { guardApi } from "@/lib/studio/server/auth";
import { archiveFile, getFileForAdmin, setFinal, setVisibility } from "@/lib/studio/server/files";
import { readJson, studioRoute } from "@/lib/studio/server/route";

export const runtime = "nodejs";

// Studio may open any client's file (admin session). ?inline=1 → images/PDF in the browser.
export async function GET(req, { params }) {
  const denied = await guardApi();
  if (denied) return denied;
  const file = await getFileForAdmin(params.id);
  const storage = getStorage();
  if (!file || file.deleted_at || !storage) return Response.json({ error: "No encontrado" }, { status: 404 });
  return deliverFile({ file, storage, inline: new URL(req.url).searchParams.get("inline") === "1" });
}

export const PATCH = (req, { params }) =>
  studioRoute(async () => {
    const b = await readJson(req);
    if (typeof b.final === "boolean") return Response.json(await setFinal(params.id, b.final));
    if (typeof b.visible === "boolean") return Response.json(await setVisibility(params.id, b.visible));
    throw new InputError("Nada para actualizar.");
  });

// "Delete" is logical: archives the file (deleted_at); bytes stay until a manual purge.
export const DELETE = (_req, { params }) => studioRoute(async () => Response.json(await archiveFile(params.id)));
