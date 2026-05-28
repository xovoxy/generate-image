import { dialog } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ExportTaskResult = {
  id: string;
  prompt: string;
  resultImages: string[];
};

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function exportGeneratedResults(tasks: ExportTaskResult[]) {
  const dialogResult = await dialog.showOpenDialog({
    title: "选择导出目录",
    properties: ["openDirectory", "createDirectory"]
  });

  if (dialogResult.canceled || !dialogResult.filePaths[0]) {
    return {
      exportedCount: 0,
      outputDir: undefined
    };
  }

  const outputDir = dialogResult.filePaths[0];
  let exportedCount = 0;

  for (const task of tasks) {
    const promptName = sanitizeFileName(task.prompt) || task.id;

    for (const [index, imagePath] of task.resultImages.entries()) {
      const extension = path.extname(imagePath) || ".png";
      const outputName = `${task.id}-${String(index + 1).padStart(2, "0")}-${promptName}${extension}`;

      await fs.copyFile(imagePath, path.join(outputDir, outputName));
      exportedCount += 1;
    }
  }

  return {
    exportedCount,
    outputDir
  };
}

export async function saveSingleResultImage(imagePath: string) {
  const extension = path.extname(imagePath) || ".png";
  const dialogResult = await dialog.showSaveDialog({
    title: "下载图片",
    defaultPath: `result${extension}`
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return {
      saved: false,
      outputPath: undefined
    };
  }

  await fs.copyFile(imagePath, dialogResult.filePath);

  return {
    saved: true,
    outputPath: dialogResult.filePath
  };
}
