import "server-only";
import { getDb } from "@/lib/studio/server/db";
import * as core from "../actions-core.js";

// Portal write operations bound to the database. Each takes a ClientScope.
const bind = (fn) => async (...a) => fn(await getDb(), ...a);
export const setSessionName = bind(core.setSessionName);
export const approveContent = bind(core.approveContent);
export const requestChanges = bind(core.requestChanges);
export const addClientComment = bind(core.addClientComment);
export const completeClientTask = bind(core.completeClientTask);
