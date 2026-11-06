#!/usr/bin/env node
// Manual maintenance of client files (no cron). Everything is a DRY RUN unless
// you pass --delete together with --confirm=<exact number of items found>.
//
//   node scripts/files-maintenance.mjs scan-orphans   [--min-age=60]
//   node scripts/files-maintenance.mjs remove-orphans --delete --confirm=N [--min-age=60]
//   node scripts/files-maintenance.mjs purge-archived [--older-than=30] [--delete --confirm=N]
//
// Env: DATABASE_URL and CLIENT_FILES_READ_WRITE_TOKEN of the SAME environment
// (never mix the Preview store with the Production database or vice versa).
// Prints pathname, age and size — never URLs or tokens.
import { createRequire } from "node:module";
import { createBlobStorage } from "../lib/files/storage-core.js";
import { purgeArchived, removeOrphanBlobs, scanOrphanBlobs } from "../lib/files/files-core.js";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const cmd = process.argv[2];
const url = process.env.DATABASE_URL;
const token = process.env.CLIENT_FILES_READ_WRITE_TOKEN;
if (!["scan-orphans", "remove-orphans", "purge-archived"].includes(cmd) || !url || !token) {
  console.error("Uso: ver el encabezado del script. Requiere DATABASE_URL y CLIENT_FILES_READ_WRITE_TOKEN.");
  process.exit(2);
}

const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 2 });
const db = { query: async (s, p = []) => (await pool.query(s, p)).rows };
const storage = createBlobStorage({ token });
const fmt = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

try {
  const minAgeMinutes = Number(args["min-age"] ?? 60);
  if (cmd === "scan-orphans") {
    const { scanned, orphans } = await scanOrphanBlobs(db, storage, { minAgeMinutes });
    console.log(`Blobs en el store: ${scanned}. Huérfanos (>= ${minAgeMinutes} min): ${orphans.length}`);
    for (const o of orphans) console.log(`  ${o.pathname}  ${fmt(o.size)}  ${o.ageMinutes} min`);
    if (orphans.length) console.log(`\nDRY RUN: no se borró nada. Para borrarlos: remove-orphans --delete --confirm=${orphans.length}`);
  } else if (cmd === "remove-orphans") {
    if (!args.delete) { console.error("Falta --delete (usá scan-orphans para ver la lista)."); process.exit(2); }
    console.log(await removeOrphanBlobs(db, storage, { minAgeMinutes, confirm: Number(args.confirm) }));
  } else {
    const olderThanDays = Number(args["older-than"] ?? 30);
    if (!args.delete) {
      const r = await purgeArchived(db, storage, { olderThanDays, dryRun: true });
      console.log(`DRY RUN: ${r.candidates} archivos archivados hace más de ${olderThanDays} días. Para purgar: --delete --confirm=${r.candidates}`);
    } else {
      console.log(await purgeArchived(db, storage, { olderThanDays, dryRun: false, confirm: Number(args.confirm) }));
    }
  }
} finally {
  await pool.end();
}
