import "server-only";
import * as core from "../../operations/queries-core.js";
import { bindDb } from "./bind";

export const { getOperations, loadSnapshot, calendarTasks } = bindDb(core);
