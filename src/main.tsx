import React from "react";
import ReactDOM from "react-dom/client";
import { getEnabledGenerateTypes, getGenerateTypeByValue } from "./domain/generationTypes";
import { createGenerationTask, createRedoTask, type GenerationTask, type TaskLog } from "./domain/tasks";
import "./styles.css";

if (!window.appBridge) {
  window.appBridge = {
    version: "browser-preview",
    getPathForFile: (file) => file.name,
    pathToFileUrl: (filePath) => filePath,
    getCozeConfigStatus: async () => ({
      hasApiToken: false,
      hasWorkflowId: false,
      isReady: false,
      taskConcurrency: 2
    }),
    getCozeConfig: async () => ({
      hasApiToken: false,
      hasWorkflowId: false,
      isReady: false,
      taskConcurrency: 2,
      workflowId: "",
      apiBase: "https://api.coze.cn",
      fileUploadPath: "/v1/files/upload",
      workflowRunPath: "/v1/workflow/run",
      workflowTimeoutMs: 300000,
      workflowHistoryPath: "/v1/workflows/:workflow_id/run_histories/:execute_id",
      workflowPollIntervalMs: 3000,
      workflowPollTimeoutMs: 600000
    }),
    saveCozeConfig: async (input) => ({
      hasApiToken: Boolean(input.apiToken),
      hasWorkflowId: Boolean(input.workflowId),
      isReady: Boolean(input.apiToken && input.workflowId),
      ...input
    }),
    uploadCozeImages: async () => {
      throw new Error("请在 Electron 应用中运行 Coze 上传。");
    },
    executeCozeWorkflow: async () => {
      throw new Error("请在 Electron 应用中运行 Coze 工作流。");
    },
    startCozeWorkflow: async () => {
      throw new Error("请在 Electron 应用中运行 Coze 工作流。");
    },
    pollCozeWorkflow: async () => {
      throw new Error("请在 Electron 应用中运行 Coze 工作流。");
    },
    runCozeTask: async () => {
      throw new Error("请在 Electron 应用中运行 Coze 任务。");
    },
    exportResults: async () => ({ exportedCount: 0 }),
    saveResultImage: async () => ({ saved: false }),
    getImageDataUrl: async (filePath) => filePath
  };
}

const TASK_STATUS_LABELS: Record<GenerationTask["status"], string> = {
  pending: "等待中",
  uploading: "上传中",
  running: "生成中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消"
};

const TASK_STORAGE_KEY = "generate-image.tasks";
type TaskStatusFilter = "all" | GenerationTask["status"];

const TASK_STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "等待" },
  { value: "uploading", label: "上传" },
  { value: "running", label: "运行" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" }
];

function createTaskLog(level: TaskLog["level"], message: string): TaskLog {
  return {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    level,
    message
  };
}

function normalizeTask(task: GenerationTask): GenerationTask {
  return {
    ...task,
    progress: task.progress ?? getFallbackProgress(task.status),
    progressLabel: task.progressLabel ?? TASK_STATUS_LABELS[task.status],
    resultImages: task.resultImages ?? [],
    originalResultImages: task.originalResultImages ?? [],
    logs: task.logs ?? []
  };
}

function loadPersistedTasks() {
  try {
    const rawTasks = localStorage.getItem(TASK_STORAGE_KEY);
    return rawTasks ? (JSON.parse(rawTasks) as GenerationTask[]).map(normalizeTask) : [];
  } catch {
    return [];
  }
}

function getFallbackProgress(status: GenerationTask["status"]) {
  switch (status) {
    case "pending":
      return 0;
    case "uploading":
      return 25;
    case "running":
      return 65;
    case "success":
      return 100;
    case "failed":
    case "cancelled":
      return 100;
  }
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

type ImageInputProps = {
  label: string;
  image?: SelectedImage;
  onChange: (image: SelectedImage) => void;
  onPreview?: (image: SelectedImage) => void;
};

type SelectedImage = {
  name: string;
  path: string;
  previewUrl: string;
};

type FullscreenPreview = {
  imageUrl: string;
  imagePath?: string;
  canDownload: boolean;
};

type ActiveView = "workspace" | "settings";

type ConfigForm = Awaited<ReturnType<Window["appBridge"]["getCozeConfig"]>> & {
  apiToken: string;
};

const CONFIG_FIELD_LABELS: Record<keyof Omit<ConfigForm, "hasApiToken" | "hasWorkflowId" | "isReady" | "apiTokenPreview">, string> = {
  apiToken: "Coze Token",
  workflowId: "Workflow ID",
  apiBase: "API Base",
  fileUploadPath: "文件上传路径",
  workflowRunPath: "工作流运行路径",
  workflowTimeoutMs: "请求超时(ms)",
  workflowHistoryPath: "历史轮询路径",
  workflowPollIntervalMs: "轮询间隔(ms)",
  workflowPollTimeoutMs: "轮询超时(ms)",
  taskConcurrency: "任务并发数"
};

function ImageInput({ label, image, onChange, onPreview }: ImageInputProps) {
  const inputId = `image-input-${label}`;

  return (
    <div className="image-input">
      <span className="image-input__label">{label}</span>
      {image ? (
        <button className="image-preview-button" type="button" onClick={() => onPreview?.(image)}>
          <img className="image-input__preview" src={image.previewUrl} alt={`${label} preview`} />
        </button>
      ) : (
        <label className="image-input__empty" htmlFor={inputId}>
          选择图片
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (file) {
            onChange({
              name: file.name,
              path: window.appBridge.getPathForFile(file) || file.name,
              previewUrl: URL.createObjectURL(file)
            });
          }
        }}
      />
    </div>
  );
}

function ResultThumbnail({
  index,
  isSelected,
  imageUrl,
  onSelect
}: {
  index: number;
  isSelected: boolean;
  imageUrl?: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={`result-thumbnail${isSelected ? " result-thumbnail--selected" : ""}`}
      type="button"
      onClick={onSelect}
    >
      {imageUrl ? <img src={imageUrl} alt={`Result ${index + 1}`} /> : null}
    </button>
  );
}

function ConfigStatusBadge({ ready }: { ready: boolean }) {
  return (
    <span className={`config-status-badge${ready ? " config-status-badge--ready" : ""}`}>
      {ready ? "已就绪" : "未完成"}
    </span>
  );
}

function App() {
  const [activeView, setActiveView] = React.useState<ActiveView>("workspace");
  const [imageA, setImageA] = React.useState<SelectedImage>();
  const [imageB, setImageB] = React.useState<SelectedImage>();
  const [imageInputResetKey, setImageInputResetKey] = React.useState(0);
  const imageARef = React.useRef<SelectedImage | undefined>(undefined);
  const imageBRef = React.useRef<SelectedImage | undefined>(undefined);
  const enabledTypes = React.useMemo(() => getEnabledGenerateTypes(), []);
  const [selectedType, setSelectedType] = React.useState(enabledTypes[0]?.type ?? 1);
  const [prompt, setPrompt] = React.useState("");
  const [tasks, setTasks] = React.useState<GenerationTask[]>(loadPersistedTasks);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(() => new Set());
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(0);
  const [fullscreenPreview, setFullscreenPreview] = React.useState<FullscreenPreview>();
  const [redoPrompt, setRedoPrompt] = React.useState("");
  const [taskConcurrency, setTaskConcurrency] = React.useState(2);
  const [isQueuePaused, setIsQueuePaused] = React.useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = React.useState<TaskStatusFilter>("all");
  const runningTaskIdsRef = React.useRef<Set<string>>(new Set());
  const [formError, setFormError] = React.useState<string>();
  const [hasAttemptedCreateTask, setHasAttemptedCreateTask] = React.useState(false);
  const [queueMessage, setQueueMessage] = React.useState<string>();
  const [settingsMessage, setSettingsMessage] = React.useState<string>();
  const [settingsError, setSettingsError] = React.useState<string>();
  const [configReady, setConfigReady] = React.useState<boolean>();
  const [configForm, setConfigForm] = React.useState<ConfigForm>();
  const [imageUrls, setImageUrls] = React.useState<Record<string, string>>({});
  const isPromptEmpty = prompt.trim().length === 0;
  const selectedGenerateType = React.useMemo(() => getGenerateTypeByValue(selectedType), [selectedType]);
  const selectedImageCount = selectedGenerateType?.imageCount ?? 2;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedResult = selectedTask?.resultImages[selectedResultIndex];
  const selectedOriginalResult = selectedTask?.originalResultImages?.[selectedResultIndex];
  const selectedImageAUrl = selectedTask?.imageAPath ? imageUrls[selectedTask.imageAPath] : undefined;
  const selectedImageBUrl = selectedTask?.imageBPath ? imageUrls[selectedTask.imageBPath] : undefined;
  const selectedResultUrl = selectedResult ? imageUrls[selectedResult] : undefined;
  const selectedOriginalResultUrl = selectedOriginalResult ? imageUrls[selectedOriginalResult] : undefined;
  const runningCount = tasks.filter((task) => task.status === "uploading" || task.status === "running").length;
  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id));
  const selectedExportableCount = selectedTasks.filter(
    (task) => task.status === "success" && task.resultImages.length > 0
  ).length;
  const allExportableTasks = tasks.filter((task) => task.status === "success" && task.resultImages.length > 0);
  const filteredTasks = tasks.filter((task) => taskStatusFilter === "all" || task.status === taskStatusFilter);
  const hasSelectedAllExportableTasks =
    allExportableTasks.length > 0 && allExportableTasks.every((task) => selectedTaskIds.has(task.id));

  function handleImageChange(setImage: React.Dispatch<React.SetStateAction<SelectedImage | undefined>>) {
    return (image: SelectedImage) => {
      setImage((currentImage) => {
        if (currentImage) {
          URL.revokeObjectURL(currentImage.previewUrl);
        }

        return image;
      });
    };
  }

  function buildTaskFromInput() {
    setFormError(undefined);

    const generateType = selectedGenerateType;
    const trimmedPrompt = prompt.trim();

    if (!generateType) {
      setFormError("请选择有效的生成类型。");
      return undefined;
    }

    if (!imageA) {
      setFormError("请先上传参考图。");
      return undefined;
    }

    if (generateType.imageCount === 2 && !imageB) {
      setFormError("请先上传图 A 和图 B。");
      return undefined;
    }

    if (!trimmedPrompt) {
      setFormError("请填写生成描述。");
      return undefined;
    }

    return createGenerationTask({
      type: generateType.type,
      typeKey: generateType.key,
      imageAPath: imageA.path,
      imageBPath: generateType.imageCount === 2 ? imageB?.path : undefined,
      prompt: trimmedPrompt
    });
  }

  function handleCreateTask() {
    setHasAttemptedCreateTask(true);

    const task = buildTaskFromInput();

    if (!task) {
      return;
    }

    enqueueTask(task);
  }

  function handleClearTaskInput() {
    if (imageA) {
      URL.revokeObjectURL(imageA.previewUrl);
    }

    if (imageB) {
      URL.revokeObjectURL(imageB.previewUrl);
    }

    setImageA(undefined);
    setImageB(undefined);
    setPrompt("");
    setFormError(undefined);
    setHasAttemptedCreateTask(false);
    setImageInputResetKey((currentKey) => currentKey + 1);

    setFullscreenPreview((currentPreview) => {
      if (
        currentPreview &&
        (currentPreview.imageUrl === imageA?.previewUrl ||
          currentPreview.imageUrl === imageB?.previewUrl ||
          currentPreview.imagePath === imageA?.path ||
          currentPreview.imagePath === imageB?.path)
      ) {
        return undefined;
      }

      return currentPreview;
    });
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(taskId)) {
        nextIds.delete(taskId);
      } else {
        nextIds.add(taskId);
      }

      return nextIds;
    });
  }

  function selectAllExportableTasks() {
    setSelectedTaskIds((currentIds) => {
      const exportableTaskIds = allExportableTasks.map((task) => task.id);
      const hasSelectedAllExportableTasks =
        exportableTaskIds.length > 0 && exportableTaskIds.every((taskId) => currentIds.has(taskId));

      if (hasSelectedAllExportableTasks) {
        const nextIds = new Set(currentIds);

        for (const taskId of exportableTaskIds) {
          nextIds.delete(taskId);
        }

        return nextIds;
      }

      return new Set([...currentIds, ...exportableTaskIds]);
    });
  }

  function deleteTasks(taskIds: string[]) {
    const taskIdSet = new Set(taskIds);
    const deletableTaskIds = new Set(
      tasks
        .filter((task) => taskIdSet.has(task.id) && task.status !== "uploading" && task.status !== "running")
      .map((task) => task.id)
    );
    const skippedCount = taskIdSet.size - deletableTaskIds.size;

    if (deletableTaskIds.size === 0) {
      setQueueMessage("运行中的任务不能删除。");
      return;
    }

    const confirmed = window.confirm(
      skippedCount > 0
        ? `确定删除 ${deletableTaskIds.size} 个任务吗？${skippedCount} 个运行中的任务会保留。`
        : `确定删除 ${deletableTaskIds.size} 个任务吗？`
    );

    if (!confirmed) {
      return;
    }

    setTasks((currentTasks) => currentTasks.filter((task) => !deletableTaskIds.has(task.id)));
    setSelectedTaskIds((currentIds) => new Set([...currentIds].filter((taskId) => !deletableTaskIds.has(taskId))));

    if (selectedTaskId && deletableTaskIds.has(selectedTaskId)) {
      setSelectedTaskId(undefined);
      setSelectedResultIndex(0);
    }

    setQueueMessage(`已删除 ${deletableTaskIds.size} 个任务。`);
  }

  function clearTasksByStatus(statuses: GenerationTask["status"][], label: string) {
    const statusSet = new Set(statuses);
    const removableTasks = tasks.filter((task) => statusSet.has(task.status));

    if (removableTasks.length === 0) {
      setQueueMessage(`没有可清理的${label}任务。`);
      return;
    }

    if (!window.confirm(`确定清理 ${removableTasks.length} 个${label}任务吗？`)) {
      return;
    }

    const removableIds = new Set(removableTasks.map((task) => task.id));

    setTasks((currentTasks) => currentTasks.filter((task) => !removableIds.has(task.id)));
    setSelectedTaskIds((currentIds) => new Set([...currentIds].filter((taskId) => !removableIds.has(taskId))));

    if (selectedTaskId && removableIds.has(selectedTaskId)) {
      setSelectedTaskId(undefined);
      setSelectedResultIndex(0);
    }

    setQueueMessage(`已清理 ${removableTasks.length} 个${label}任务。`);
  }

  function enqueueTask(task: GenerationTask) {
    setTasks((currentTasks) => [task, ...currentTasks]);
    setSelectedTaskId(task.id);
    setSelectedResultIndex(0);
  }

  function appendTaskLog(taskId: string, level: TaskLog["level"], message: string) {
    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              logs: [...(item.logs ?? []), createTaskLog(level, message)],
              updatedAt: new Date().toISOString()
            }
          : item
      )
    );
  }

  async function pollTaskResult(task: GenerationTask, executeId: string) {
    try {
      const result = await window.appBridge.pollCozeWorkflow({
        taskId: task.id,
        executeId,
        type: task.type,
        imageAPath: task.imageAPath,
        imageBPath: task.imageBPath
      });

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "success",
                progress: 100,
                progressLabel: "生成完成",
                resultImages: result.resultImages,
                originalResultImages: result.originalResultImages ?? [],
                executeId: result.executeId ?? item.executeId ?? executeId,
                debugUrl: result.debugUrl ?? item.debugUrl,
                logs: [...(item.logs ?? []), createTaskLog("info", `任务完成，返回 ${result.resultImages.length} 张结果图。`)],
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "生成失败。";

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "failed",
                progress: 100,
                progressLabel: "任务失败",
                errorMessage,
                logs: [...(item.logs ?? []), createTaskLog("error", errorMessage)],
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
    } finally {
      runningTaskIdsRef.current.delete(task.id);
    }
  }

  async function executeTask(task: GenerationTask) {
    if (runningTaskIdsRef.current.has(task.id)) {
      return;
    }

    runningTaskIdsRef.current.add(task.id);

    setTasks((currentTasks) => {
      const uploadingTask = {
        ...task,
        status: "uploading" as const,
        progress: 20,
        progressLabel: "正在上传参考图",
        errorMessage: undefined,
        logs: [...(task.logs ?? []), createTaskLog("info", "开始上传参考图。")],
        updatedAt: new Date().toISOString()
      };

      return currentTasks.map((item) => (item.id === task.id ? uploadingTask : item));
    });

    try {
      const uploadedImages = await window.appBridge.uploadCozeImages({
        imageAPath: task.imageAPath,
        imageBPath: task.imageBPath
      });

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "running",
                progress: 55,
                progressLabel: "参考图上传完成，正在启动工作流",
                logs: [...(item.logs ?? []), createTaskLog("info", "参考图上传完成，准备启动 Coze 工作流。")],
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );

      const started = await window.appBridge.startCozeWorkflow({
        type: task.type,
        image1Id: uploadedImages.image1Id,
        image2Id: uploadedImages.image2Id,
        prompt: task.prompt
      });

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "running",
                progress: 65,
                progressLabel: "工作流执行中，正在轮询结果",
                executeId: started.executeId,
                debugUrl: started.debugUrl,
                logs: [...(item.logs ?? []), createTaskLog("info", `工作流已启动，execute_id=${started.executeId}。`)],
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );

      await pollTaskResult(task, started.executeId);
    } catch (error) {
      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: "failed",
                progress: 100,
                progressLabel: "任务失败",
                errorMessage: error instanceof Error ? error.message : "生成失败。",
                logs: [
                  ...(item.logs ?? []),
                  createTaskLog("error", error instanceof Error ? error.message : "生成失败。")
                ],
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
    } finally {
      runningTaskIdsRef.current.delete(task.id);
    }
  }

  function handleRedoSelectedTask() {
    if (!selectedTask) {
      return;
    }

    const trimmedPrompt = redoPrompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    enqueueTask(createRedoTask(selectedTask, trimmedPrompt));
  }

  async function handleDownloadFullscreenResult() {
    if (!fullscreenPreview?.imagePath || !fullscreenPreview.canDownload) {
      return;
    }

    await window.appBridge.saveResultImage(fullscreenPreview.imagePath);
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setQueueMessage(`已复制${label}。`);
  }

  function handleRetryTask(task: GenerationTask) {
    enqueueTask(createRedoTask(task));
  }

  function handleRetryFailedTasks() {
    const failedTasks = tasks.filter((task) => task.status === "failed");

    for (const task of failedTasks) {
      handleRetryTask(task);
    }
  }

  function handlePauseQueue() {
    setIsQueuePaused(true);
  }

  function handleResumeQueue() {
    setIsQueuePaused(false);
  }

  async function exportTasks(tasksToExport: GenerationTask[]) {
    const exportableTasks = tasksToExport.filter((task) => task.status === "success" && task.resultImages.length > 0);

    if (exportableTasks.length === 0) {
      setQueueMessage("没有可导出的成功结果。");
      return;
    }

    const result = await window.appBridge.exportResults({
      tasks: exportableTasks.map((task) => ({
        id: task.id,
        prompt: task.prompt,
        resultImages: task.resultImages
      }))
    });

    setQueueMessage(
      result.exportedCount > 0 ? `已导出 ${result.exportedCount} 张图片。` : "已取消导出。"
    );
  }

  async function refreshConfig() {
    setSettingsError(undefined);

    try {
      const config = await window.appBridge.getCozeConfig();

      setConfigReady(config.isReady);
      setTaskConcurrency(config.taskConcurrency || 2);
      setConfigForm({
        ...config,
        apiToken: ""
      });
    } catch (error) {
      const status = await window.appBridge.getCozeConfigStatus();

      setConfigReady(status.isReady);
      setTaskConcurrency(status.taskConcurrency || 2);
      setConfigForm({
        ...status,
        workflowId: "",
        apiBase: "https://api.coze.cn",
        fileUploadPath: "/v1/files/upload",
        workflowRunPath: "/v1/workflow/run",
        workflowTimeoutMs: 300000,
        workflowHistoryPath: "/v1/workflows/:workflow_id/run_histories/:execute_id",
        workflowPollIntervalMs: 3000,
        workflowPollTimeoutMs: 600000,
        apiToken: ""
      });
      setSettingsError(error instanceof Error ? error.message : "配置读取失败，请重启应用后重试。");
    }
  }

  function updateConfigField<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) {
    setConfigForm((currentConfig) => (currentConfig ? { ...currentConfig, [key]: value } : currentConfig));
  }

  async function handleSaveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configForm) {
      return;
    }

    setSettingsError(undefined);

    try {
      const savedConfig = await window.appBridge.saveCozeConfig({
        apiToken: configForm.apiToken.trim() || undefined,
        workflowId: configForm.workflowId,
        apiBase: configForm.apiBase,
        fileUploadPath: configForm.fileUploadPath,
        workflowRunPath: configForm.workflowRunPath,
        workflowTimeoutMs: Number(configForm.workflowTimeoutMs),
        workflowHistoryPath: configForm.workflowHistoryPath,
        workflowPollIntervalMs: Number(configForm.workflowPollIntervalMs),
        workflowPollTimeoutMs: Number(configForm.workflowPollTimeoutMs),
        taskConcurrency: Number(configForm.taskConcurrency)
      });

      setConfigReady(savedConfig.isReady);
      setTaskConcurrency(savedConfig.taskConcurrency || 2);
      setConfigForm({ ...savedConfig, apiToken: "" });
      setSettingsMessage("配置已保存，后续新任务会使用最新配置。");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "配置保存失败。");
    }
  }

  React.useEffect(() => {
    void refreshConfig();
  }, []);

  React.useEffect(() => {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  React.useEffect(() => {
    const resumableTasks = tasks.filter(
      (task) => task.status === "running" && task.executeId && !runningTaskIdsRef.current.has(task.id)
    );

    for (const task of resumableTasks) {
      runningTaskIdsRef.current.add(task.id);
      appendTaskLog(task.id, "info", "检测到未完成任务，继续轮询结果。");
      void pollTaskResult(task, task.executeId as string);
    }

    const interruptedUploadTasks = tasks.filter(
      (task) => (task.status === "uploading" || task.status === "running") && !task.executeId
    );

    if (interruptedUploadTasks.length === 0) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        (task.status === "uploading" || task.status === "running") && !task.executeId
          ? {
              ...task,
              status: "failed",
              progress: 100,
              progressLabel: "任务中断",
              errorMessage: "应用重启时任务仍在上传阶段，无法恢复，请重试。",
              logs: [...(task.logs ?? []), createTaskLog("error", "应用重启时任务仍在上传阶段，无法恢复，请重试。")],
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );
  }, []);

  React.useEffect(() => {
    if (!queueMessage) {
      return;
    }

    const timer = window.setTimeout(() => setQueueMessage(undefined), 2500);

    return () => window.clearTimeout(timer);
  }, [queueMessage]);

  React.useEffect(() => {
    if (!settingsMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSettingsMessage(undefined), 2500);

    return () => window.clearTimeout(timer);
  }, [settingsMessage]);

  React.useEffect(() => {
    setSelectedTaskIds((currentIds) => {
      const taskIds = new Set(tasks.map((task) => task.id));
      const nextIds = new Set([...currentIds].filter((taskId) => taskIds.has(taskId)));

      return nextIds.size === currentIds.size ? currentIds : nextIds;
    });
  }, [tasks]);

  React.useEffect(() => {
    if (isQueuePaused) {
      return;
    }

    const availableSlots = Math.max(0, taskConcurrency - runningTaskIdsRef.current.size);

    if (availableSlots === 0) {
      return;
    }

    const tasksToRun = tasks
      .filter((task) => task.status === "pending" && !runningTaskIdsRef.current.has(task.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, availableSlots);

    for (const task of tasksToRun) {
      void executeTask(task);
    }
  }, [tasks, taskConcurrency, isQueuePaused]);

  React.useEffect(() => {
    setRedoPrompt(selectedTask?.prompt ?? "");
  }, [selectedTask]);

  React.useEffect(() => {
    if (!selectedTask) {
      return;
    }

    const paths = [
      selectedTask.imageAPath,
      selectedTask.imageBPath,
      fullscreenPreview?.imagePath,
      ...selectedTask.resultImages,
      ...(selectedTask.originalResultImages ?? [])
    ].filter(isString).filter((filePath) => !imageUrls[filePath]);

    if (paths.length === 0) {
      return;
    }

    let isCancelled = false;

    Promise.all(
      paths.map(async (filePath) => {
        try {
          return [filePath, await window.appBridge.getImageDataUrl(filePath)] as const;
        } catch {
          return [filePath, undefined] as const;
        }
      })
    ).then((entries) => {
      if (isCancelled) {
        return;
      }

      setImageUrls((currentUrls) => {
        const nextUrls = { ...currentUrls };

        for (const [filePath, imageUrl] of entries) {
          if (imageUrl) {
            nextUrls[filePath] = imageUrl;
          }
        }

        return nextUrls;
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedTask, fullscreenPreview?.imagePath, imageUrls]);

  React.useEffect(() => {
    imageARef.current = imageA;
    imageBRef.current = imageB;
  }, [imageA, imageB]);

  React.useEffect(() => {
    return () => {
      if (imageARef.current) {
        URL.revokeObjectURL(imageARef.current.previewUrl);
      }

      if (imageBRef.current) {
        URL.revokeObjectURL(imageBRef.current.previewUrl);
      }
    };
  }, []);

  return (
    <main className={`app-shell${activeView === "settings" ? " app-shell--settings" : ""}`}>
      <section className="panel input-panel">
        <h1>批量生图工作台</h1>
        <p>选择生成类型，上传参考图，输入一句话后生成图片。</p>
        {configReady === false ? (
          <p className="config-warning">Coze Token 或 Workflow ID 尚未配置。</p>
        ) : null}
        <nav className="side-nav" aria-label="页面导航">
          <button
            className={`side-nav__button${activeView === "workspace" ? " side-nav__button--active" : ""}`}
            type="button"
            onClick={() => setActiveView("workspace")}
          >
            工作台
          </button>
          <button
            className={`side-nav__button${activeView === "settings" ? " side-nav__button--active" : ""}`}
            type="button"
            onClick={() => setActiveView("settings")}
          >
            配置
          </button>
        </nav>
        {activeView === "workspace" ? (
          <div className="input-stack">
          <label className="field">
            <span className="field__label">生成类型</span>
            <select
              className="select"
              value={selectedType}
              onChange={(event) => {
                setSelectedType(Number(event.currentTarget.value));
                setFormError(undefined);
              }}
            >
              {enabledTypes.map((type) => (
                <option key={type.key} value={type.type}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <div className="image-input-grid">
            <ImageInput
              key={`image-a-${imageInputResetKey}`}
              label={selectedImageCount === 1 ? "参考图" : "图 A"}
              image={imageA}
              onChange={handleImageChange(setImageA)}
              onPreview={(image) => setFullscreenPreview({ imageUrl: image.previewUrl, imagePath: image.path, canDownload: false })}
            />
            {selectedImageCount === 2 ? (
              <ImageInput
                key={`image-b-${imageInputResetKey}`}
                label="图 B"
                image={imageB}
                onChange={handleImageChange(setImageB)}
                onPreview={(image) => setFullscreenPreview({ imageUrl: image.previewUrl, imagePath: image.path, canDownload: false })}
              />
            ) : null}
          </div>
          <label className="field">
            <span className="field__label">生成描述</span>
            <textarea
              className="textarea"
              value={prompt}
              rows={4}
              placeholder="用一句话描述想要生成的图片"
              onChange={(event) => setPrompt(event.currentTarget.value)}
            />
            {hasAttemptedCreateTask && isPromptEmpty ? <span className="field__hint">生成前需要填写描述。</span> : null}
          </label>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="task-form-actions">
            <button className="primary-button" type="button" onClick={handleCreateTask}>
              创建任务
            </button>
            <button className="secondary-button" type="button" onClick={handleClearTaskInput}>
              清空
            </button>
          </div>
          </div>
        ) : (
          <div className="settings-intro">
            <ConfigStatusBadge ready={Boolean(configReady)} />
            <p>配置 Coze 连接、工作流和队列调度参数。</p>
          </div>
        )}
      </section>
      {activeView === "workspace" ? (
        <>
      <section className="panel queue-panel">
        <div className="queue-header">
          <div>
            <h2>任务队列</h2>
            <p className="queue-summary">
              运行 {runningCount}，等待 {pendingCount}，并发 {taskConcurrency}，显示 {filteredTasks.length}
            </p>
          </div>
          {isQueuePaused ? (
            <button className="compact-button" type="button" onClick={handleResumeQueue}>
              继续调度
            </button>
          ) : (
            <button className="compact-button" type="button" onClick={handlePauseQueue}>
              暂停调度
            </button>
          )}
        </div>
        <div className="queue-filter-bar" aria-label="任务筛选">
          {TASK_STATUS_FILTERS.map((filter) => (
            <button
              className={`filter-button${taskStatusFilter === filter.value ? " filter-button--active" : ""}`}
              key={filter.value}
              type="button"
              onClick={() => setTaskStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="queue-actions">
          <button
            className="compact-button"
            type="button"
            disabled={allExportableTasks.length === 0}
            onClick={selectAllExportableTasks}
          >
            {hasSelectedAllExportableTasks ? "取消全选成功" : "全选成功"}
          </button>
          <button
            className="compact-button"
            type="button"
            disabled={selectedTaskIds.size > 0 ? selectedExportableCount === 0 : allExportableTasks.length === 0}
            onClick={() => void exportTasks(selectedTaskIds.size > 0 ? selectedTasks : tasks)}
          >
            {selectedTaskIds.size > 0 ? `导出 (${selectedExportableCount})` : "导出"}
          </button>
          <details className="queue-more">
            <summary>更多操作</summary>
            <div className="queue-more__menu">
              <button
                className="menu-button"
                type="button"
                disabled={!tasks.some((task) => task.status === "failed")}
                onClick={handleRetryFailedTasks}
              >
                重试失败
              </button>
              <button
                className="menu-button"
                type="button"
                disabled={!tasks.some((task) => task.status === "failed")}
                onClick={() => clearTasksByStatus(["failed"], "失败")}
              >
                清理失败
              </button>
              <button
                className="menu-button"
                type="button"
                disabled={!tasks.some((task) => task.status === "success")}
                onClick={() => clearTasksByStatus(["success"], "成功")}
              >
                清理成功
              </button>
              <button
                className="menu-button"
                type="button"
                disabled={!tasks.some((task) => task.status !== "uploading" && task.status !== "running")}
                onClick={() => clearTasksByStatus(["pending", "success", "failed", "cancelled"], "历史")}
              >
                清理历史
              </button>
            </div>
          </details>
          <button
            className="compact-danger-button"
            type="button"
            disabled={selectedTaskIds.size === 0 && !selectedTask}
            onClick={() => deleteTasks(selectedTaskIds.size > 0 ? [...selectedTaskIds] : selectedTask ? [selectedTask.id] : [])}
          >
            {selectedTaskIds.size > 0 ? `删除 (${selectedTaskIds.size})` : "删除当前"}
          </button>
        </div>
        {queueMessage ? <p className="export-message">{queueMessage}</p> : null}
        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p>暂无任务。</p>
          ) : (
            filteredTasks.map((task) => (
              <article
                className={`task-row${task.id === selectedTaskId ? " task-row--selected" : ""}`}
                key={task.id}
                onClick={() => {
                  setSelectedTaskId(task.id);
                  setSelectedResultIndex(0);
                }}
              >
                <input
                  className="task-checkbox"
                  type="checkbox"
                  checked={selectedTaskIds.has(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label="选择任务"
                />
                <div>
                  <strong>{task.typeKey}</strong>
                  <p>{task.prompt}</p>
                  {task.errorMessage ? <p className="task-error">{task.errorMessage}</p> : null}
                </div>
                <div className="task-actions">
                  <span className={`status-pill status-pill--${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span>
                  {task.status === "failed" ? (
                    <button
                      className="tiny-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRetryTask(task);
                      }}
                    >
                      重试
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="panel preview-panel">
        <h2>任务详情</h2>
        {!selectedTask ? (
          <p>选择一条任务后查看详情。</p>
        ) : (
          <div className="detail-stack">
            <div className="detail-header">
              <span className={`status-pill status-pill--${selectedTask.status}`}>
                {TASK_STATUS_LABELS[selectedTask.status]}
              </span>
              <span className="task-id">ID {selectedTask.id}</span>
            </div>
            {(selectedTask.executeId || selectedTask.debugUrl) ? (
              <section className="detail-section">
                <h3>执行信息</h3>
                <div className="metadata-list">
                  {selectedTask.executeId ? (
                    <div className="metadata-row">
                      <span>execute_id</span>
                      <button
                        className="metadata-value"
                        type="button"
                        onClick={() => void copyText(selectedTask.executeId as string, "执行 ID")}
                      >
                        {selectedTask.executeId}
                      </button>
                    </div>
                  ) : null}
                  {selectedTask.debugUrl ? (
                    <div className="metadata-row">
                      <span>debug_url</span>
                      <button
                        className="metadata-value"
                        type="button"
                        onClick={() => void copyText(selectedTask.debugUrl as string, "调试链接")}
                      >
                        {selectedTask.debugUrl}
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
            <div className="progress-block">
              <div className="progress-meta">
                <span>{selectedTask.progressLabel}</span>
                <strong>{selectedTask.progress}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${selectedTask.progress}%` }} />
              </div>
            </div>
            <section className="detail-section">
              <h3>参考图</h3>
              <div className="reference-grid">
                <figure>
                  {selectedImageAUrl ? (
                    <button
                      className="detail-image-button"
                      type="button"
                      onClick={() =>
                        setFullscreenPreview({
                          imageUrl: selectedImageAUrl,
                          imagePath: selectedTask.imageAPath,
                          canDownload: false
                        })
                      }
                    >
                      <img src={selectedImageAUrl} alt="Reference A" />
                    </button>
                  ) : (
                    <div className="image-placeholder">图 A 不可预览</div>
                  )}
                  <figcaption>{getFileName(selectedTask.imageAPath)}</figcaption>
                </figure>
                {selectedTask.imageBPath ? (
                  <figure>
                    {selectedImageBUrl ? (
                      <button
                        className="detail-image-button"
                        type="button"
                        onClick={() =>
                          setFullscreenPreview({
                            imageUrl: selectedImageBUrl,
                            imagePath: selectedTask.imageBPath,
                            canDownload: false
                          })
                        }
                      >
                        <img src={selectedImageBUrl} alt="Reference B" />
                      </button>
                    ) : (
                      <div className="image-placeholder">图 B 不可预览</div>
                    )}
                    <figcaption>{getFileName(selectedTask.imageBPath)}</figcaption>
                  </figure>
                ) : null}
              </div>
            </section>
            <section className="detail-section">
              <h3>提示词</h3>
              <p className="prompt-preview">{selectedTask.prompt}</p>
            </section>
            {selectedTask.errorMessage ? (
              <section className="detail-section">
                <h3>报错信息</h3>
                <pre className="error-detail">{selectedTask.errorMessage}</pre>
              </section>
            ) : null}
            <section className="detail-section">
              <h3>结果图</h3>
              {selectedTask.status !== "success" ? (
                <p>当前任务还没有可预览的结果。</p>
              ) : selectedResult && selectedResultUrl ? (
                <div className="preview-stack">
                  <div className="result-compare-grid">
                    <figure className="result-variant">
                      <button
                        className="result-preview-button"
                        type="button"
                        onClick={() =>
                          setFullscreenPreview({
                            imageUrl: selectedResultUrl,
                            imagePath: selectedResult,
                            canDownload: true
                          })
                        }
                      >
                        <img
                          className="result-preview"
                          src={selectedResultUrl}
                          alt="Cropped generated result"
                        />
                      </button>
                      <figcaption>
                        <span>裁剪后</span>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void window.appBridge.saveResultImage(selectedResult)}
                        >
                          下载
                        </button>
                      </figcaption>
                    </figure>
                    {selectedOriginalResult && selectedOriginalResultUrl ? (
                      <figure className="result-variant">
                        <button
                          className="result-preview-button"
                          type="button"
                          onClick={() =>
                            setFullscreenPreview({
                              imageUrl: selectedOriginalResultUrl,
                              imagePath: selectedOriginalResult,
                              canDownload: true
                            })
                          }
                        >
                          <img
                            className="result-preview"
                            src={selectedOriginalResultUrl}
                            alt="Original generated result"
                          />
                        </button>
                        <figcaption>
                          <span>裁剪前</span>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => void window.appBridge.saveResultImage(selectedOriginalResult)}
                          >
                            下载
                          </button>
                        </figcaption>
                      </figure>
                    ) : null}
                  </div>
                  {selectedTask.resultImages.length > 1 ? (
                    <div className="result-thumbnails">
                      {selectedTask.resultImages.map((resultPath, index) => (
                        <ResultThumbnail
                          key={resultPath}
                          index={index}
                          isSelected={index === selectedResultIndex}
                          imageUrl={imageUrls[resultPath]}
                          onSelect={() => {
                            setSelectedResultIndex(index);

                            if (imageUrls[resultPath]) {
                              setFullscreenPreview({
                                imageUrl: imageUrls[resultPath],
                                imagePath: resultPath,
                                canDownload: true
                              });
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>任务成功，但没有返回可预览的图片。</p>
              )}
            </section>
            <div className="detail-actions">
            <label className="field">
              <span className="field__label">重做描述</span>
              <textarea
                className="textarea"
                value={redoPrompt}
                rows={3}
                onChange={(event) => setRedoPrompt(event.currentTarget.value)}
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={redoPrompt.trim().length === 0}
              onClick={handleRedoSelectedTask}
            >
              重做
            </button>
            </div>
            <section className="detail-section detail-section--logs">
              <h3>任务日志</h3>
              {selectedTask.logs.length === 0 ? (
                <p>暂无日志。</p>
              ) : (
                <div className="task-log-list">
                  {selectedTask.logs.map((log) => (
                    <div className={`task-log task-log--${log.level}`} key={log.id}>
                      <time>{new Date(log.time).toLocaleTimeString()}</time>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
        </>
      ) : (
        <section className="panel settings-panel">
          <div className="settings-header">
            <div>
              <h2>配置</h2>
              <p>保存后会写入项目根目录的 .env，新建任务会立即读取最新参数。</p>
            </div>
            <ConfigStatusBadge ready={Boolean(configReady)} />
          </div>
          {!configForm ? (
            <p>正在读取配置...</p>
          ) : (
            <form className="settings-form" onSubmit={(event) => void handleSaveConfig(event)}>
              <section className="settings-section">
                <h3>Coze 工作流</h3>
                <div className="settings-grid">
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.apiToken}</span>
                    <input
                      className="text-input"
                      type="password"
                      value={configForm.apiToken}
                      placeholder={configForm.apiTokenPreview ? `当前 ${configForm.apiTokenPreview}，留空不修改` : "请输入 Coze Token"}
                      onChange={(event) => updateConfigField("apiToken", event.currentTarget.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowId}</span>
                    <input
                      className="text-input"
                      value={configForm.workflowId}
                      onChange={(event) => updateConfigField("workflowId", event.currentTarget.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.apiBase}</span>
                    <input
                      className="text-input"
                      value={configForm.apiBase}
                      onChange={(event) => updateConfigField("apiBase", event.currentTarget.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.taskConcurrency}</span>
                    <input
                      className="text-input"
                      min={1}
                      max={8}
                      type="number"
                      value={configForm.taskConcurrency}
                      onChange={(event) => updateConfigField("taskConcurrency", Number(event.currentTarget.value))}
                    />
                  </label>
                </div>
              </section>
              <section className="settings-section">
                <h3>接口路径</h3>
                <div className="settings-grid">
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.fileUploadPath}</span>
                    <input
                      className="text-input"
                      value={configForm.fileUploadPath}
                      onChange={(event) => updateConfigField("fileUploadPath", event.currentTarget.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowRunPath}</span>
                    <input
                      className="text-input"
                      value={configForm.workflowRunPath}
                      onChange={(event) => updateConfigField("workflowRunPath", event.currentTarget.value)}
                    />
                  </label>
                  <label className="field settings-grid__wide">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowHistoryPath}</span>
                    <input
                      className="text-input"
                      value={configForm.workflowHistoryPath}
                      onChange={(event) => updateConfigField("workflowHistoryPath", event.currentTarget.value)}
                    />
                  </label>
                </div>
              </section>
              <section className="settings-section">
                <h3>超时与轮询</h3>
                <div className="settings-grid">
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowTimeoutMs}</span>
                    <input
                      className="text-input"
                      min={1000}
                      step={1000}
                      type="number"
                      value={configForm.workflowTimeoutMs}
                      onChange={(event) => updateConfigField("workflowTimeoutMs", Number(event.currentTarget.value))}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowPollIntervalMs}</span>
                    <input
                      className="text-input"
                      min={1000}
                      step={500}
                      type="number"
                      value={configForm.workflowPollIntervalMs}
                      onChange={(event) => updateConfigField("workflowPollIntervalMs", Number(event.currentTarget.value))}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">{CONFIG_FIELD_LABELS.workflowPollTimeoutMs}</span>
                    <input
                      className="text-input"
                      min={1000}
                      step={1000}
                      type="number"
                      value={configForm.workflowPollTimeoutMs}
                      onChange={(event) => updateConfigField("workflowPollTimeoutMs", Number(event.currentTarget.value))}
                    />
                  </label>
                </div>
              </section>
              {settingsError ? <p className="form-error">{settingsError}</p> : null}
              {settingsMessage ? <p className="export-message">{settingsMessage}</p> : null}
              <div className="settings-actions">
                <button className="primary-button" type="submit">
                  保存配置
                </button>
                <button className="secondary-button" type="button" onClick={() => void refreshConfig()}>
                  重新读取
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {fullscreenPreview ? (
        <div className="fullscreen-preview" role="dialog" aria-modal="true">
          <div className="fullscreen-toolbar">
            <button className="secondary-button" type="button" onClick={() => setFullscreenPreview(undefined)}>
              关闭
            </button>
            {fullscreenPreview.canDownload ? (
              <button className="primary-button" type="button" onClick={() => void handleDownloadFullscreenResult()}>
                下载
              </button>
            ) : null}
          </div>
          <img className="fullscreen-image" src={fullscreenPreview.imageUrl} alt="Fullscreen preview" />
        </div>
      ) : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
