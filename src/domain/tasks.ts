export type TaskStatus =
  | "pending"
  | "uploading"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type TaskLog = {
  id: string;
  time: string;
  level: "info" | "error";
  message: string;
};

export type GenerationTask = {
  id: string;
  type: number;
  typeKey: string;
  imageAPath: string;
  imageBPath?: string;
  prompt: string;
  status: TaskStatus;
  progress: number;
  progressLabel: string;
  resultImages: string[];
  originalResultImages: string[];
  errorMessage?: string;
  executeId?: string;
  debugUrl?: string;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
  retryFromTaskId?: string;
};

export type CreateGenerationTaskInput = {
  type: number;
  typeKey: string;
  imageAPath: string;
  imageBPath?: string;
  prompt: string;
};

export function createGenerationTask(
  input: CreateGenerationTaskInput,
  now = new Date()
): GenerationTask {
  const timestamp = now.toISOString();

  return {
    id: crypto.randomUUID(),
    type: input.type,
    typeKey: input.typeKey,
    imageAPath: input.imageAPath,
    imageBPath: input.imageBPath,
    prompt: input.prompt,
    status: "pending",
    progress: 0,
    progressLabel: "等待开始",
    resultImages: [],
    originalResultImages: [],
    logs: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createRedoTask(
  sourceTask: GenerationTask,
  prompt = sourceTask.prompt,
  now = new Date()
): GenerationTask {
  return {
    ...createGenerationTask(
      {
        type: sourceTask.type,
        typeKey: sourceTask.typeKey,
        imageAPath: sourceTask.imageAPath,
        imageBPath: sourceTask.imageBPath,
        prompt
      },
      now
    ),
    retryFromTaskId: sourceTask.id
  };
}
