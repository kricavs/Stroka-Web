import "server-only";
import { errorResponse } from "../../studio/errors.js";
import { requireClientApi } from "./scope";

// Portal JSON endpoints: valid session ⇒ ClientScope (never from the request),
// uniform error mapping. The Origin/CSRF check already ran in middleware.
export async function portalRoute(fn) {
  const { scope, denied } = await requireClientApi();
  if (denied) return denied;
  try {
    return await fn(scope);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function readBody(req) {
  const text = await req.text().catch(() => "");
  if (text.length > 20_000) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
