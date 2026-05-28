import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type CozeConfig = {
  apiToken: string;
  workflowId: string;
  apiBase: string;
  fileUploadPath: string;
  workflowRunPath: string;
  workflowTimeoutMs: number;
  workflowHistoryPath: string;
  workflowPollIntervalMs: number;
  workflowPollTimeoutMs: number;
};

export type CozeConfigStatus = {
  hasApiToken: boolean;
  hasWorkflowId: boolean;
  isReady: boolean;
  taskConcurrency: number;
};

let hasLoadedDotEnv = false;

function loadDotEnv() {
  if (hasLoadedDotEnv) {
    return;
  }

  hasLoadedDotEnv = true;

  const envPath = path.join(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const envContent = readFileSync(envPath, "utf8");

  for (const line of envContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getCozeConfigStatus(): CozeConfigStatus {
  loadDotEnv();

  const hasApiToken = Boolean(process.env.COZE_API_TOKEN);
  const hasWorkflowId = Boolean(process.env.COZE_WORKFLOW_ID);

  return {
    hasApiToken,
    hasWorkflowId,
    isReady: hasApiToken && hasWorkflowId,
    taskConcurrency: Number(process.env.TASK_CONCURRENCY || 2)
  };
}

export function getCozeConfig(): CozeConfig {
  loadDotEnv();

  const apiToken = process.env.COZE_API_TOKEN;
  const workflowId = process.env.COZE_WORKFLOW_ID;

  if (!apiToken || !workflowId) {
    throw new Error("Missing Coze configuration. Please set COZE_API_TOKEN and COZE_WORKFLOW_ID.");
  }

  return {
    apiToken,
    workflowId,
    apiBase: process.env.COZE_API_BASE || "https://api.coze.cn",
    fileUploadPath: process.env.COZE_FILE_UPLOAD_PATH || "/v1/files/upload",
    workflowRunPath: process.env.COZE_WORKFLOW_RUN_PATH || "/v1/workflow/run",
    workflowTimeoutMs: Number(process.env.COZE_WORKFLOW_TIMEOUT_MS || 300000),
    workflowHistoryPath:
      process.env.COZE_WORKFLOW_HISTORY_PATH || "/v1/workflows/:workflow_id/run_histories/:execute_id",
    workflowPollIntervalMs: Number(process.env.COZE_WORKFLOW_POLL_INTERVAL_MS || 3000),
    workflowPollTimeoutMs: Number(process.env.COZE_WORKFLOW_POLL_TIMEOUT_MS || 600000)
  };
}
