import { NextResponse } from "next/server";
import { getDb } from "@/lib/studio/server/db";
import { attemptLogin } from "@/lib/portal/auth-core.js";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal/cookie";
import { portalIpHash } from "@/lib/portal/server/session.js";

export const runtime = "nodejs";

const INVALID = "Empresa o código incorrectos.";

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const company = String(body.company ?? "").slice(0, 200);
  const code = String(body.code ?? "").slice(0, 64);

  try {
    const result = await attemptLogin(await getDb(), {
      company,
      code,
      ipHash: portalIpHash(req),
      userAgent: req.headers.get("user-agent"),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason === "throttled" ? "Demasiados intentos. Probá de nuevo en unos minutos." : INVALID },
        { status: result.reason === "throttled" ? 429 : 401 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PORTAL_COOKIE, result.token, portalCookieOptions());
    return res;
  } catch (err) {
    console.error("[portal] login", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Probá más tarde." }, { status: 500 });
  }
}
