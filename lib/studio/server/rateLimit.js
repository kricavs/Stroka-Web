import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";

export function clientIpHash(req) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.STUDIO_SESSION_SECRET || ""}|${ip}`)
    .digest("hex")
    .slice(0, 32);
}

// Fixed-window counter in Postgres. Returns true when the call is allowed.
export async function allow(key, limit, windowSeconds) {
  const db = await getDb();
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const [r] = await db.query(
    `INSERT INTO rate_limits (key, count) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [`${key}:${bucket}`]
  );
  if (Math.random() < 0.05) {
    await db.query(`DELETE FROM rate_limits WHERE created_at < now() - interval '2 days'`).catch(() => {});
  }
  return r.count <= limit;
}
