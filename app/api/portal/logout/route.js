import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/studio/server/db";
import { revokeSessionByToken } from "@/lib/portal/auth-core.js";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal/cookie";
import { hashToken } from "@/lib/portal/token.js";

export const runtime = "nodejs";

export async function POST() {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (token && token.length <= 256) await revokeSessionByToken(await getDb(), hashToken(token));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_COOKIE, "", portalCookieOptions(0));
  return res;
}
