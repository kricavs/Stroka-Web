import "server-only";
import * as core from "../content-core.js";
import { bindDb } from "./bind";

export const {
  createContent, updateContent, changeStatus, reopenContent, getContent, listContent, clientMonthStats, dashboardData,
  addStudioComment, listStudioComments, registerExternalApproval, contentApprovals, contentHistory,
} = bindDb(core);
export const { EXTERNAL_CHANNELS } = core;
