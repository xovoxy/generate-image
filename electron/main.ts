import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import {
  executeCozeWorkflow,
  pollCozeWorkflowResult,
  persistWorkflowResultImages,
  runCozeGenerationTask,
  startCozeWorkflow,
  uploadCozeImagePair
} from "./cozeClient";
import { getCozeConfigStatus, getEditableCozeConfig, saveCozeConfig } from "./config";
import { exportGeneratedResults, saveSingleResultImage } from "./exportResults";
import { getImageDataUrl } from "./media";

const isDev = !app.isPackaged;

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 720,
    title: "Batch Image Generator",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("coze:get-config-status", () => getCozeConfigStatus());
  ipcMain.handle("coze:get-config", () => getEditableCozeConfig());
  ipcMain.handle("coze:save-config", (_event, input) => saveCozeConfig(input));
  ipcMain.handle("coze:upload-images", (_event, input) =>
    uploadCozeImagePair(input.imageAPath, input.imageBPath)
  );
  ipcMain.handle("coze:start-workflow", (_event, input) => startCozeWorkflow(input));
  ipcMain.handle("coze:poll-workflow", async (_event, input) => {
    const result = await pollCozeWorkflowResult(input.executeId);

    return {
      ...result,
      resultImages: await persistWorkflowResultImages(result.resultImages, input.taskId)
    };
  });
  ipcMain.handle("coze:execute-workflow", async (_event, input) => {
    const result = await executeCozeWorkflow(input);

    return {
      ...result,
      resultImages: await persistWorkflowResultImages(result.resultImages, input.taskId)
    };
  });
  ipcMain.handle("coze:run-task", (_event, input) => runCozeGenerationTask(input));
  ipcMain.handle("results:export", (_event, input) => exportGeneratedResults(input.tasks));
  ipcMain.handle("results:save-image", (_event, imagePath) => saveSingleResultImage(imagePath));
  ipcMain.handle("media:get-data-url", (_event, filePath) => getImageDataUrl(filePath));

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
