import "server-only";
import { getDb } from "./db";

// Turns a db-injected core module into functions that fetch the db themselves.
export function bindDb(core) {
  return Object.fromEntries(
    Object.entries(core).map(([k, f]) => (typeof f === "function" ? [k, async (...a) => f(await getDb(), ...a)] : [k, f]))
  );
}
