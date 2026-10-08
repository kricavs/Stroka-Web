import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Hash format: scrypt.<saltHex>.<hashHex>  (no "$": safe inside .env files)

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt.${salt.toString("hex")}.${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || "").split(".");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
