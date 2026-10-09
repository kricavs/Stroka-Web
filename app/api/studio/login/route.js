import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/studio/server/password.mjs";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/studio/session";

export const runtime = "nodejs";

// Best-effort brute-force throttle (per server instance; see README limits).
const attempts = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(req) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const rec = attempts.get(ip);
  if (rec && rec.fails >= MAX_FAILS && Date.now() < rec.until) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá un minuto." }, { status: 429 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {}
  const user = String(body.user || "");
  const password = String(body.password || "");

  const expectedUser = process.env.STUDIO_USER;
  const hash = process.env.STUDIO_PASSWORD_HASH;
  const userOk = !!expectedUser && user === expectedUser;
  // Always run the hash to keep timing uniform.
  const passOk = !!hash && verifyPassword(password, hash);
  const token = userOk && passOk ? await createSessionToken() : null;

  if (!token) {
    await sleep(500);
    attempts.set(ip, { fails: (rec?.fails || 0) + 1, until: Date.now() + LOCK_MS });
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
