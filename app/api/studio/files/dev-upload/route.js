import { getPepper } from "@/lib/portal/access-code.js";
import { FILE_TYPES, extOf } from "@/lib/files/rules.js";
import { authorizeUploadToken } from "@/lib/studio/server/files";
import { guardApi } from "@/lib/studio/server/auth";
import { filesMode, getStorage } from "@/lib/files/server/storage";

export const runtime = "nodejs";

// DEVELOPMENT ONLY (local filesystem store): stands in for the direct browser →
// Blob upload. Disabled whenever the real private store is configured or in production.
export async function PUT(req) {
  const denied = await guardApi();
  if (denied) return denied;
  if (filesMode() !== "fs") return Response.json({ error: "No disponible" }, { status: 404 });
  const u = new URL(req.url).searchParams;
  const pathname = u.get("pathname") || "";
  const type = FILE_TYPES[extOf(pathname)];
  if (!type || !authorizeUploadToken({ pathname, intent: u.get("intent"), clientId: u.get("clientId"), category: u.get("category"), maxBytes: type.max }, getPepper())) {
    return Response.json({ error: "Subida no autorizada" }, { status: 403 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > type.max) return Response.json({ error: "Tamaño inválido" }, { status: 400 });
  await getStorage().put(pathname, bytes);
  return Response.json({ ok: true });
}
