import "server-only";
import * as core from "../tasks-core.js";
import { bindDb } from "./bind";

export const { createTask, updateTask, setTaskStatus, getTask, listTasks, taskCounts } = bindDb(core);
