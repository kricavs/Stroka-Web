import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/studio/session";
import { PORTAL_COOKIE } from "@/lib/portal/cookie";
import { isSameOriginRequest } from "@/lib/portal/origin";

// Guards the private studio (/studio/*, /api/studio/*) and runs the cheap
// edge checks for the client portal (/portal/*, /api/portal/*). The real
// authorisation is repeated server-side inside pages and handlers.
export const config = {
  matcher: ["/studio/:path*", "/api/studio/:path*", "/portal/:path*", "/api/portal/:path*"],
};

const PUBLIC_PATHS = ["/studio/login", "/api/studio/login"];

// Portal: independent from Studio auth. The edge can't reach the database, so
// it only (1) rejects cross-site mutations and (2) bounces requests that carry
// no portal cookie. Whether the cookie is a *valid session of an active
// client* is decided server-side (requireClient / requireClientApi) on every
// request — a present cookie is never trusted by itself.
const PORTAL_PUBLIC = ["/portal", "/api/portal/login"];

function portalMiddleware(req) {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const isApi = pathname.startsWith("/api/");

  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOriginRequest(req)) {
    return Response.json({ error: "Origen no permitido" }, { status: 403 });
  }
  if (PORTAL_PUBLIC.includes(pathname)) return NextResponse.next();
  if (req.cookies.get(PORTAL_COOKIE)?.value) return NextResponse.next();

  if (isApi) return Response.json({ error: "No autorizado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/portal";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/")) {
    return portalMiddleware(req);
  }
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
