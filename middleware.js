import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/studio/session";

// Guards the private studio. Runs on the server for every /studio/* page and
// /api/studio/* endpoint; the same check is repeated inside the handlers.
export const config = { matcher: ["/studio/:path*", "/api/studio/:path*"] };

const PUBLIC_PATHS = ["/studio/login", "/api/studio/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CSRF defence-in-depth (cookie is also SameSite=Strict): mutating requests
  // must come from the same origin.
  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return Response.json({ error: "Origen no permitido" }, { status: 403 });
    }
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (isApi) return Response.json({ error: "No autorizado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/studio/login";
  url.search = "";
  return NextResponse.redirect(url);
}
