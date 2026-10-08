import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "../session";

// Server-side check, independent from middleware (defence in depth).
export async function hasSession() {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  if (!(await hasSession())) redirect("/studio/login");
}

// For route handlers: returns a 401 Response, or null when authorised.
export async function guardApi() {
  if (await hasSession()) return null;
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
