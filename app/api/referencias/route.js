import { validateReference } from "@/lib/testimonials-shared";
import { allow, clientIpHash } from "@/lib/studio/server/rateLimit";
import { createTestimonial } from "@/lib/studio/server/testimonials";

export const runtime = "nodejs";

const MIN_FILL_MS = 3000;

// Public endpoint. Everything lands as `pending`; nothing is shown until it is
// approved from Studio.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });

  // Humans take more than a few seconds to write a comment.
  const opened = Number(body.t);
  if (!Number.isFinite(opened) || Date.now() - opened < MIN_FILL_MS) {
    return Response.json({ error: "Probá nuevamente en unos segundos." }, { status: 429 });
  }

  const { ok, errors, value } = validateReference(body);
  if (!ok) return Response.json({ errors }, { status: 400 });

  try {
    const ipHash = clientIpHash(req);
    const allowed = (await allow(`ref:ip:${ipHash}`, 3, 3600)) && (await allow("ref:global", 40, 86400));
    if (!allowed) {
      return Response.json({ error: "Recibimos varios envíos. Intentá de nuevo más tarde." }, { status: 429 });
    }
    await createTestimonial(value, ipHash);
  } catch {
    return Response.json({ error: "No pudimos guardar tu comentario. Intentá más tarde." }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
