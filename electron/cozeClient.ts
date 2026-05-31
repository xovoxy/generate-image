import { app, nativeImage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCozeConfig } from "./config";

type CozeFileUploadResponse = {
  data?: {
    id?: string;
    file_id?: string;
  };
  id?: string;
  file_id?: string;
  code?: number;
  msg?: string;
  message?: string;
};

function safeJsonPreview(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "string" && item.length > 240) {
      return `${item.slice(0, 120)}...${item.slice(-40)}`;
    }

    return item;
  });
}

function extractUploadedFileId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return extractUploadedFileId(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractUploadedFileId(item);

      if (id) {
        return id;
      }
    }

    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.id === "string") {
      return record.id;
    }

    if (typeof record.file_id === "string") {
      return record.file_id;
    }

    for (const item of Object.values(record)) {
      const id = extractUploadedFileId(item);

      if (id) {
        return id;
      }
    }
  }

  return undefined;
}

export type UploadedCozeFile = {
  id: string;
  fileName: string;
};

export type CozeWorkflowInput = {
  type: number;
  image1Id: string;
  image2Id?: string;
  prompt: string;
};

export type CozeTaskInput = {
  type: number;
  imageAPath: string;
  imageBPath?: string;
  prompt: string;
};

export type CozeWorkflowResult = {
  resultImages: string[];
  executeId?: string;
  debugUrl?: string;
  raw: unknown;
};

export type CozeWorkflowStartResult = {
  executeId: string;
  debugUrl?: string;
  raw: unknown;
};

type CozeApiResponse = {
  code?: number;
  msg?: string;
  message?: string;
  data?: unknown;
};

const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;

type UploadableImage = {
  fileName: string;
  bytes: Uint8Array<ArrayBuffer>;
};

function getCompressedImageFileName(filePath: string) {
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);

  return `${baseName}-compressed.jpg`;
}

function toUploadBytes(buffer: Buffer) {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);

  return bytes;
}

async function prepareUploadImage(filePath: string): Promise<UploadableImage> {
  const originalBuffer = await fs.readFile(filePath);

  if (originalBuffer.byteLength <= MAX_UPLOAD_IMAGE_BYTES) {
    return {
      fileName: path.basename(filePath),
      bytes: toUploadBytes(originalBuffer)
    };
  }

  const sourceImage = nativeImage.createFromPath(filePath);

  if (sourceImage.isEmpty()) {
    throw new Error(`图片超过 10MB，且无法压缩该图片：${path.basename(filePath)}`);
  }

  const originalSize = sourceImage.getSize();
  let scale = 1;
  let quality = 88;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const resizedImage =
      scale < 1
        ? sourceImage.resize({
            width: Math.max(1, Math.round(originalSize.width * scale)),
            height: Math.max(1, Math.round(originalSize.height * scale))
          })
        : sourceImage;

    const compressedBuffer = resizedImage.toJPEG(quality);

    if (compressedBuffer.byteLength <= MAX_UPLOAD_IMAGE_BYTES) {
      return {
        fileName: getCompressedImageFileName(filePath),
        bytes: toUploadBytes(compressedBuffer)
      };
    }

    if (quality > 48) {
      quality -= 10;
    } else {
      scale *= 0.82;
    }
  }

  throw new Error(`图片压缩后仍超过 10MB，请换一张更小的图片：${path.basename(filePath)}`);
}

export async function uploadCozeFile(filePath: string): Promise<UploadedCozeFile> {
  const config = getCozeConfig();
  const uploadImage = await prepareUploadImage(filePath);
  const formData = new FormData();

  formData.append("file", new Blob([uploadImage.bytes]), uploadImage.fileName);

  const response = await fetch(`${config.apiBase}${config.fileUploadPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`
    },
    body: formData
  });

  const responseBody = (await response.json().catch(() => ({}))) as CozeFileUploadResponse;

  if (!response.ok) {
    throw new Error(responseBody.msg || responseBody.message || `Coze file upload failed: ${response.status}`);
  }

  if (typeof responseBody.code === "number" && responseBody.code !== 0) {
    throw new Error(responseBody.msg || responseBody.message || `Coze file upload failed: ${safeJsonPreview(responseBody)}`);
  }

  const id = extractUploadedFileId(responseBody);

  if (!id) {
    throw new Error(`Coze file upload response did not include data.id: ${safeJsonPreview(responseBody)}`);
  }

  return {
    id,
    fileName: uploadImage.fileName
  };
}

export async function uploadCozeImagePair(imageAPath: string, imageBPath: string) {
  const [imageA, imageB] = await Promise.all([
    uploadCozeFile(imageAPath),
    uploadCozeFile(imageBPath)
  ]);

  return {
    image1Id: imageA.id,
    image2Id: imageB.id
  };
}

export async function uploadCozeImages(imageAPath: string, imageBPath?: string) {
  if (!imageBPath) {
    const imageA = await uploadCozeFile(imageAPath);

    return {
      image1Id: imageA.id,
      image2Id: undefined
    };
  }

  return uploadCozeImagePair(imageAPath, imageBPath);
}

function collectImageUrls(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const urls = trimmedValue.match(/https?:\/\/[^\s"')]+/g) ?? [];

    if (urls.length > 0) {
      return urls;
    }

    try {
      return collectImageUrls(JSON.parse(trimmedValue));
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageUrls(item));
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => collectImageUrls(item));
  }

  return [];
}

function getExplicitOutputPayload(value: unknown): unknown {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return getExplicitOutputPayload(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const output = getExplicitOutputPayload(item);

      if (output !== undefined) {
        return output;
      }
    }

    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("output" in record) {
      return record.output;
    }

    if ("outputs" in record) {
      return getExplicitOutputPayload(record.outputs);
    }

    if ("data" in record) {
      return getExplicitOutputPayload(record.data);
    }
  }

  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(status: unknown) {
  return typeof status === "string" ? status.toLowerCase().replace(/[\s_-]/g, "") : "";
}

function isFinishedWorkflowStatus(value: unknown) {
  const status = normalizeStatus(value);
  return ["success", "succeeded", "completed", "complete"].includes(status);
}

function isFailedWorkflowStatus(value: unknown) {
  const status = normalizeStatus(value);
  return ["failed", "fail", "error", "canceled", "cancelled", "timeout"].includes(status);
}

function extractExecuteId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return extractExecuteId(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const executeId = extractExecuteId(item);

      if (executeId) {
        return executeId;
      }
    }

    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["execute_id", "executeId"]) {
      if (typeof record[key] === "string") {
        return record[key] as string;
      }
    }

    for (const item of Object.values(record)) {
      const executeId = extractExecuteId(item);

      if (executeId) {
        return executeId;
      }
    }
  }

  return undefined;
}

function extractDebugUrl(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return extractDebugUrl(JSON.parse(value));
    } catch {
      return value.startsWith("http") && value.includes("work_flow") ? value : undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const debugUrl = extractDebugUrl(item);

      if (debugUrl) {
        return debugUrl;
      }
    }

    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["debug_url", "debugUrl"]) {
      if (typeof record[key] === "string") {
        return record[key] as string;
      }
    }

    for (const item of Object.values(record)) {
      const debugUrl = extractDebugUrl(item);

      if (debugUrl) {
        return debugUrl;
      }
    }
  }

  return undefined;
}

function extractWorkflowStatus(value: unknown): unknown {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return extractWorkflowStatus(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const status = extractWorkflowStatus(item);

      if (status) {
        return status;
      }
    }

    return undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["execute_status", "status", "state"]) {
    if (record[key]) {
      return record[key];
    }
  }

  if (record.data) {
    return extractWorkflowStatus(record.data);
  }

  return undefined;
}

function buildWorkflowHistoryPath(template: string, workflowId: string, executeId: string) {
  return template
    .replace(":workflow_id", encodeURIComponent(workflowId))
    .replace(":execute_id", encodeURIComponent(executeId));
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const requestInit: RequestInit = {
      ...init,
      signal: abortController.signal
    };

    const response = await fetch(url, requestInit);
    const responseBody = (await response.json().catch(() => ({}))) as CozeApiResponse;

    if (!response.ok) {
      throw new Error(responseBody.msg || responseBody.message || `Coze request failed: ${response.status}`);
    }

    if (typeof responseBody.code === "number" && responseBody.code !== 0) {
      throw new Error(responseBody.msg || responseBody.message || `Coze request failed: ${safeJsonPreview(responseBody)}`);
    }

    return responseBody;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (error instanceof Error && error.name === "AbortError") {
      const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
      const timeoutSeconds = Math.round(timeoutMs / 1000);

      if (elapsedMs >= timeoutMs * 0.95) {
        throw new Error(`Coze request timed out after ${timeoutSeconds} seconds.`);
      }

      throw new Error(
        `Coze request was aborted after ${elapsedSeconds} seconds before the configured ${timeoutSeconds}-second timeout. Original error: ${error.message || error.name}`
      );
    }

    if (error instanceof Error && error.message.includes("fetch failed")) {
      throw new Error(
        `Coze request failed after ${(elapsedMs / 1000).toFixed(1)} seconds. Please check your network, proxy, and Coze API URL. Original error: ${error.message}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function startCozeWorkflow(input: CozeWorkflowInput): Promise<CozeWorkflowStartResult> {
  const config = getCozeConfig();
  const parameters: Record<string, unknown> = {
    image1: {
      file_id: input.image1Id
    },
    prompt: input.prompt,
    type: input.type
  };

  if (input.image2Id) {
    parameters.image2 = {
      file_id: input.image2Id
    };
  }

  const responseBody = await fetchJsonWithTimeout(
    `${config.apiBase}${config.workflowRunPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workflow_id: config.workflowId,
        is_async: true,
        parameters
      })
    },
    config.workflowTimeoutMs
  );

  const executeId = extractExecuteId(responseBody);
  const debugUrl = extractDebugUrl(responseBody);

  if (!executeId) {
    throw new Error(`Coze async workflow response did not include execute_id: ${safeJsonPreview(responseBody)}`);
  }

  console.log(`[coze] workflow started execute_id=${executeId}`);

  return {
    executeId,
    debugUrl,
    raw: responseBody
  };
}

async function getCozeWorkflowHistory(executeId: string) {
  const config = getCozeConfig();
  const historyPath = buildWorkflowHistoryPath(config.workflowHistoryPath, config.workflowId, executeId);

  return fetchJsonWithTimeout(
    `${config.apiBase}${historyPath}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiToken}`
      }
    },
    config.workflowTimeoutMs
  );
}

export async function pollCozeWorkflowResult(executeId: string): Promise<CozeWorkflowResult> {
  const config = getCozeConfig();
  const startedAt = Date.now();
  let lastHistory: unknown;

  while (Date.now() - startedAt <= config.workflowPollTimeoutMs) {
    const history = await getCozeWorkflowHistory(executeId);
    lastHistory = history;
    const status = extractWorkflowStatus(history);
    const outputPayload = getExplicitOutputPayload(history);
    const resultImages = collectImageUrls(outputPayload);
    const debugUrl = extractDebugUrl(history);

    console.log(
      `[coze] polling execute_id=${executeId} status=${String(status ?? "unknown")} has_output=${outputPayload !== undefined} images=${resultImages.length}`
    );

    if (resultImages.length > 0 && isFinishedWorkflowStatus(status)) {
      return {
        resultImages,
        executeId,
        debugUrl,
        raw: history
      };
    }

    if (isFinishedWorkflowStatus(status) && resultImages.length === 0) {
      throw new Error(`Coze workflow completed but output did not include image URLs: ${safeJsonPreview(history)}`);
    }

    if (isFailedWorkflowStatus(status)) {
      throw new Error(`Coze workflow failed: ${safeJsonPreview(history)}`);
    }

    await sleep(config.workflowPollIntervalMs);
  }

  throw new Error(
    `Coze workflow polling timed out after ${Math.round(config.workflowPollTimeoutMs / 1000)} seconds. Last history: ${safeJsonPreview(lastHistory)}`
  );
}

export async function executeCozeWorkflow(input: CozeWorkflowInput): Promise<CozeWorkflowResult> {
  const started = await startCozeWorkflow(input);

  return pollCozeWorkflowResult(started.executeId);
}

function getImageExtension(url: string, contentType: string | null) {
  if (contentType?.includes("png")) {
    return ".png";
  }

  if (contentType?.includes("webp")) {
    return ".webp";
  }

  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
    return ".jpg";
  }

  const extension = path.extname(new URL(url).pathname);
  return extension || ".png";
}

async function saveRemoteImage(url: string, taskId: string, index: number) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }

  const outputDir = path.join(app.getPath("userData"), "generated", taskId);
  await fs.mkdir(outputDir, { recursive: true });

  const extension = getImageExtension(url, response.headers.get("content-type"));
  const outputPath = path.join(outputDir, `result-${String(index + 1).padStart(2, "0")}${extension}`);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(outputPath, imageBuffer);

  return outputPath;
}

export async function persistWorkflowResultImages(resultImages: string[], taskId: string) {
  return Promise.all(resultImages.map((url, index) => saveRemoteImage(url, taskId, index)));
}

export async function runCozeGenerationTask(input: CozeTaskInput & { taskId: string }): Promise<CozeWorkflowResult> {
  const uploadedImages = await uploadCozeImages(input.imageAPath, input.imageBPath);

  const result = await executeCozeWorkflow({
    type: input.type,
    image1Id: uploadedImages.image1Id,
    image2Id: uploadedImages.image2Id,
    prompt: input.prompt
  });

  return {
    ...result,
    resultImages: await persistWorkflowResultImages(result.resultImages, input.taskId)
  };
}
