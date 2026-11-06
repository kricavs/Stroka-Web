// Signed upload intents (Node only). Kept apart from rules.js so client components can import the rules.
import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless proof that Studio asked for THIS pathname (for THIS client/category/size)
// before the browser uploads straight to the store.
const INTENT_TTL_MS = 30 * 60 * 1000;
const sign = (secret, data) => createHmac("sha256", secret).update(`client-file-intent|${data}`).digest("base64url");

export function makeIntent({ pathname, clientId, category, maxBytes }, secret, now = Date.now()) {
  const exp = now + INTENT_TTL_MS;
  return `${exp}.${sign(secret, `${pathname}|${clientId}|${category}|${maxBytes}|${exp}`)}`;
}
export function verifyIntent(intent, { pathname, clientId, category, maxBytes }, secret, now = Date.now()) {
  const [exp, mac] = String(intent ?? "").split(".");
  if (!/^\d+$/.test(exp || "") || !mac || Number(exp) < now) return false;
  const want = sign(secret, `${pathname}|${clientId}|${category}|${maxBytes}|${exp}`);
  const a = Buffer.from(mac), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

