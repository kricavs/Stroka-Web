import "server-only";
import { mintScope } from "@/lib/portal/scope-core.js";
import { hasSession } from "./auth";

// "VER COMO CLIENTE": an authenticated Studio admin renders the portal for a
// given client. The scope is `admin-preview` — read-only (see assertWritable)
// and never backed by a portal session or cookie.
export async function adminPreviewScope(clientId) {
  if (!(await hasSession())) throw new Error("Se requiere sesión de Studio.");
  // Fase 1: also verify that the client exists before minting.
  return mintScope({ clientId: String(clientId), source: "admin-preview" });
}
