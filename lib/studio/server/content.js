import "server-only";
import * as core from "../content-core.js";
import { bindDb } from "./bind";

export const {
  createContent, updateContent, changeStatus, getContent, listContent, clientMonthStats, dashboardData,
} = bindDb(core);
