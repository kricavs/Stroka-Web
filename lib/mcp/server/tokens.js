import "server-only";
import * as core from "../tokens-core.js";
import { bindDb } from "@/lib/studio/server/bind";

export const { createMcpToken, revokeMcpToken, regenerateMcpToken, listMcpTokens } = bindDb(core);
