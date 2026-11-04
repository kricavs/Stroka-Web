// Same-origin check for state-changing portal requests. Edge-safe.
// Never throws (a malformed or "null" Origin is simply rejected).

export function isSameOriginRequest(req) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser callers / same-origin GET-like navigations
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
