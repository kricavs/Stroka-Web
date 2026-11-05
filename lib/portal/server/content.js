import "server-only";
import { contentRepo } from "../content-core.js";
import { scopedQuery } from "./scoped.js";

export const { getProfile, listVisible, listUndated, getVisible, nextPublication, monthSummary } = contentRepo(scopedQuery);
