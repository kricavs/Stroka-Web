import "server-only";
import * as core from "../clients-core.js";
import { bindDb } from "./bind";

export const {
  createClient, updateClient, setActive, generateAccess, revokeSessions,
  setMonthGoal, getClient, listClients, listActivity, clientOptions, unlockAccess,
} = bindDb(core);
export const { parseClientInput } = core;
