export type TaskStatus =
  | "pending"
  | "uploading"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type GenerationTask = {
  id: string;
  type: number;
  typeKey: string;
  imageAPath: string;
  imageBPath: string;
  prompt: string;
  status: TaskStatus;
  progress: number;
  progressLabel: string;
  resultImages: string[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  retryFromTaskId?: string;
};

export type CreateGenerationTaskInput = {
  type: number;
  typeKey: string;
  imageAPath: string;
  imageBPath: string;
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
