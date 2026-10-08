// Usage: npm run studio:hash -- "mi-password"
import { hashPassword } from "../lib/studio/server/password.mjs";
const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Uso: npm run studio:hash -- "password-de-al-menos-10-caracteres"');
  process.exit(1);
}
console.log(`STUDIO_PASSWORD_HASH=${hashPassword(pw)}`);
console.log(`STUDIO_SESSION_SECRET=${(await import("node:crypto")).randomBytes(32).toString("hex")}`);
