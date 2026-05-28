import { promises as fs } from "node:fs";
import path from "node:path";

function getMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

export async function getImageDataUrl(filePath: string) {
  const fileBuffer = await fs.readFile(filePath);
  return `data:${getMimeType(filePath)};base64,${fileBuffer.toString("base64")}`;
}
