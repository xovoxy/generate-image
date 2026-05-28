import { contextBridge, ipcRenderer, webUtils } from "electron";
import { pathToFileURL } from "node:url";

contextBridge.exposeInMainWorld("appBridge", {
  version: "0.1.0",
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  pathToFileUrl: (filePath: string) => pathToFileURL(filePath).toString(),
  getCozeConfigStatus: () => ipcRenderer.invoke("coze:get-config-status"),
  getCozeConfig: () => ipcRenderer.invoke("coze:get-config"),
  saveCozeConfig: (input: {
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
  }) => ipcRenderer.invoke("coze:save-config", input),
  uploadCozeImages: (input: { imageAPath: string; imageBPath: string }) =>
    ipcRenderer.invoke("coze:upload-images", input),
  executeCozeWorkflow: (input: {
    taskId: string;
    type: number;
    image1Id: string;
    image2Id: string;
    prompt: string;
  }) => ipcRenderer.invoke("coze:execute-workflow", input),
  startCozeWorkflow: (input: {
    type: number;
    image1Id: string;
    image2Id: string;
    prompt: string;
  }) => ipcRenderer.invoke("coze:start-workflow", input),
  pollCozeWorkflow: (input: { taskId: string; executeId: string }) =>
    ipcRenderer.invoke("coze:poll-workflow", input),
  runCozeTask: (input: { taskId: string; type: number; imageAPath: string; imageBPath: string; prompt: string }) =>
    ipcRenderer.invoke("coze:run-task", input),
  exportResults: (input: { tasks: { id: string; prompt: string; resultImages: string[] }[] }) =>
    ipcRenderer.invoke("results:export", input),
  saveResultImage: (imagePath: string) => ipcRenderer.invoke("results:save-image", imagePath),
  getImageDataUrl: (filePath: string) => ipcRenderer.invoke("media:get-data-url", filePath)
});
