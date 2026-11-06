import "server-only";
import { filesRepo } from "../files-core.js";
import { scopedQuery } from "./scoped.js";

export const { listFiles, listForContent, getForDownload, deliverableCount } = filesRepo(scopedQuery);
