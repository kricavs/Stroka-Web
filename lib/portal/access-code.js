// Client access codes: `STK-XXXXX-XXXXX`.
//
//  - 10 symbols from a 31-char alphabet with no look-alikes (no 0/O, 1/I/L):
//    31^10 ≈ 2^49.5, drawn with crypto.randomInt (uniform, no modulo bias).
//  - Stored only as scrypt(HMAC-SHA256(PORTAL_SECRET, code)) with a per-code
//    salt. The pepper means a database leak alone can't be brute-forced
//    offline; scrypt makes guessing slow either way.
//  - The plaintext exists only in the response that generates it.
//
// Node-only (crypto) but otherwise pure: unit-tested directly.
import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

export function getPepper(env = process.env) {
  const s = env.PORTAL_SECRET;
  if (!s || s.length < 32) throw new Error("PORTAL_SECRET no está configurada (mínimo 32 caracteres).");
  return s;
}

export function generateAccessCode() {
  let raw = "";
  for (let i = 0; i < 10; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `STK-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

// What a person types → the 10 canonical symbols, or null if it can't be a code.
export function normalizeCode(input) {
  let s = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("STK") && s.length === 13) s = s.slice(3);
  if (s.length !== 10) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

const pre = (canonical, pepper) => createHmac("sha256", pepper).update(canonical).digest();

const scryptAsync = (pw, salt) =>
  new Promise((resolve, reject) => scrypt(pw, salt, KEYLEN, SCRYPT, (e, k) => (e ? reject(e) : resolve(k))));

// Format: `s1$<salt b64url>$<hash b64url>`
export async function hashAccessCode(canonical, pepper = getPepper()) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pre(canonical, pepper), salt);
  return `s1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

// Cost is the same whether `stored` is real or the dummy, and whether or not
// `canonical` is null (malformed input still burns one scrypt).
export async function verifyAccessCode(canonical, stored, pepper = getPepper()) {
  const parts = String(stored || "").split("$");
  const valid = parts.length === 3 && parts[0] === "s1";
  const salt = valid ? Buffer.from(parts[1], "base64url") : Buffer.alloc(16);
  const expected = valid ? Buffer.from(parts[2], "base64url") : Buffer.alloc(KEYLEN);
  const key = await scryptAsync(pre(canonical ?? "-", pepper), salt);
  const same = key.length === expected.length && timingSafeEqual(key, expected);
  return Boolean(canonical) && valid && same;
}

// A hash nobody has the preimage of, for unknown / inactive companies.
let dummy;
export async function dummyHash(pepper = getPepper()) {
  dummy ||= hashAccessCode(CODE_ALPHABET.slice(0, 10), pepper);
  return dummy;
}
