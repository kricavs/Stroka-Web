// Signed-cookie session using Web Crypto, so it runs in both Edge middleware
// and Node route handlers. Stateless: cookie = `<expiresAtMs>.<signature>`.

export const SESSION_COOKIE = "stk_studio";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const enc = new TextEncoder();

function b64url(buf) {
  let s = "";
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(message) {
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!secret || secret.length < 32) return null; // misconfigured: nobody gets in
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionToken() {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const sig = await sign(`v1.${exp}`);
  return sig ? `${exp}.${sig}` : null;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const expected = await sign(`v1.${exp}`);
  return !!expected && safeEqual(sig, expected);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}
