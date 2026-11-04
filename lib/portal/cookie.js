// Portal session cookie constants. Edge-safe (used by middleware) — no Node
// APIs, no server-only. Completely independent from the Studio cookie
// (`stk_studio`): neither cookie is ever accepted by the other surface.

const prod = process.env.NODE_ENV === "production";

// `__Host-` (prod only: requires Secure) pins the cookie to this exact host,
// path "/" and forbids a Domain attribute, so a sibling subdomain can't set it.
export const PORTAL_COOKIE = prod ? "__Host-stk_portal" : "stk_portal";
export const PORTAL_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// SameSite=Lax (not Strict like Studio): clients arrive from WhatsApp / mail
// links, and Strict would drop the cookie on that first navigation.
// CSRF on mutations is covered by the Origin check in middleware.
export function portalCookieOptions(maxAge = PORTAL_MAX_AGE) {
  return { httpOnly: true, secure: prod, sameSite: "lax", path: "/", maxAge };
}
