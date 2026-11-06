import { getDb } from "@/lib/studio/server/db";
import { getStorage } from "@/lib/files/server/storage";
import { deliverFile } from "@/lib/files/server/serve";
import { recordDownload } from "@/lib/portal/files-core.js";
import { getForDownload } from "@/lib/portal/server/files";
import { requireClientApi } from "@/lib/portal/server/scope";

export const runtime = "nodejs";

// The only way a client gets a file: session → ClientScope → row of THIS client
// (404 otherwise, never 403) → 302 to a short-lived signed GET URL for that one
// pathname (the bytes never cross this Function). ?inline=1 shows images/PDF in
// the browser; otherwise it downloads.
export async function GET(req, { params }) {
  const { scope, denied } = await requireClientApi();
  if (denied) return denied;
  const notFound = () => Response.json({ error: "No encontrado" }, { status: 404 });
  try {
    const file = await getForDownload(scope, params.id);
    const storage = getStorage();
    if (!file || !storage) return notFound();
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    if (!inline) await recordDownload(await getDb(), scope, file).catch((e) => console.error("[files] download log", e.message));
    return await deliverFile({ file, storage, inline });
  } catch (err) {
    console.error("[files] portal download", err);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
