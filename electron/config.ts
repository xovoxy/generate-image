import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

export type EditableCozeConfig = CozeConfigStatus & {
  apiTokenPreview?: string;
  workflowId: string;
  apiBase: string;
  fileUploadPath: string;
  workflowRunPath: string;
  workflowTimeoutMs: number;
  workflowHistoryPath: string;
  workflowPollIntervalMs: number;
  workflowPollTimeoutMs: number;
};

export type SaveCozeConfigInput = {
  apiToken?: string;
  workflowId: string;
  apiBase: string;
  fileUploadPath: string;
  workflowRunPath: string;
  workflowTimeoutMs: number;
  workflowHistoryPath: string;
  workflowPollIntervalMs: number;
  workflowPollTimeoutMs: number;
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

function getOptionalConfigValue(key: string, fallback: string) {
  return process.env[key] || fallback;
}

function getOptionalConfigNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function previewSecret(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.length <= 8 ? "已配置" : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function getEditableCozeConfig(): EditableCozeConfig {
  loadDotEnv();

  return {
    ...getCozeConfigStatus(),
    apiTokenPreview: previewSecret(process.env.COZE_API_TOKEN),
    workflowId: process.env.COZE_WORKFLOW_ID || "",
    apiBase: getOptionalConfigValue("COZE_API_BASE", "https://api.coze.cn"),
    fileUploadPath: getOptionalConfigValue("COZE_FILE_UPLOAD_PATH", "/v1/files/upload"),
    workflowRunPath: getOptionalConfigValue("COZE_WORKFLOW_RUN_PATH", "/v1/workflow/run"),
    workflowTimeoutMs: getOptionalConfigNumber("COZE_WORKFLOW_TIMEOUT_MS", 300000),
    workflowHistoryPath: getOptionalConfigValue(
      "COZE_WORKFLOW_HISTORY_PATH",
      "/v1/workflows/:workflow_id/run_histories/:execute_id"
    ),
    workflowPollIntervalMs: getOptionalConfigNumber("COZE_WORKFLOW_POLL_INTERVAL_MS", 3000),
    workflowPollTimeoutMs: getOptionalConfigNumber("COZE_WORKFLOW_POLL_TIMEOUT_MS", 600000)
  };
}

function serializeEnvValue(value: string | number) {
  return String(value).replace(/\n/g, "");
}

export function saveCozeConfig(input: SaveCozeConfigInput): EditableCozeConfig {
  loadDotEnv();

  const nextToken = input.apiToken?.trim() || process.env.COZE_API_TOKEN || "";
  const entries: Record<string, string | number> = {
    COZE_API_TOKEN: nextToken,
    COZE_WORKFLOW_ID: input.workflowId.trim(),
    COZE_API_BASE: input.apiBase.trim() || "https://api.coze.cn",
    COZE_FILE_UPLOAD_PATH: input.fileUploadPath.trim() || "/v1/files/upload",
    COZE_WORKFLOW_RUN_PATH: input.workflowRunPath.trim() || "/v1/workflow/run",
    COZE_WORKFLOW_TIMEOUT_MS: input.workflowTimeoutMs || 300000,
    COZE_WORKFLOW_HISTORY_PATH:
      input.workflowHistoryPath.trim() || "/v1/workflows/:workflow_id/run_histories/:execute_id",
    COZE_WORKFLOW_POLL_INTERVAL_MS: input.workflowPollIntervalMs || 3000,
    COZE_WORKFLOW_POLL_TIMEOUT_MS: input.workflowPollTimeoutMs || 600000,
    TASK_CONCURRENCY: input.taskConcurrency || 2
  };

  for (const [key, value] of Object.entries(entries)) {
    process.env[key] = serializeEnvValue(value);
  }

  const envContent = `${Object.entries(entries)
    .map(([key, value]) => `${key}=${serializeEnvValue(value)}`)
    .join("\n")}\n`;

  writeFileSync(path.join(process.cwd(), ".env"), envContent, "utf8");

  return getEditableCozeConfig();
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
