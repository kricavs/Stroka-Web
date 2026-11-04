import "server-only";
import { guardApi } from "./auth";
import { errorResponse } from "../errors.js";

// Studio JSON endpoints: session check + uniform error mapping.
export async function studioRoute(fn) {
  const denied = await guardApi();
  if (denied) return denied;
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}

export const readJson = async (req) => (await req.json().catch(() => null)) || {};
