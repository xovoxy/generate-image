import React from "react";
import ReactDOM from "react-dom/client";
import { getEnabledGenerateTypes, getGenerateTypeByValue } from "./domain/generationTypes";
import { createGenerationTask, createRedoTask, type GenerationTask } from "./domain/tasks";
import "./styles.css";

const TASK_STATUS_LABELS: Record<GenerationTask["status"], string> = {
  pending: "等待中",
  uploading: "上传中",
  running: "生成中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消"
};

const TASK_STORAGE_KEY = "generate-image.tasks";

function normalizeTask(task: GenerationTask): GenerationTask {
  return {
    ...task,
    progress: task.progress ?? getFallbackProgress(task.status),
    progressLabel: task.progressLabel ?? TASK_STATUS_LABELS[task.status]
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

function App() {
  const [imageA, setImageA] = React.useState<SelectedImage>();
  const [imageB, setImageB] = React.useState<SelectedImage>();
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
  const runningTaskIdsRef = React.useRef<Set<string>>(new Set());
  const [formError, setFormError] = React.useState<string>();
  const [queueMessage, setQueueMessage] = React.useState<string>();
  const [configReady, setConfigReady] = React.useState<boolean>();
  const [imageUrls, setImageUrls] = React.useState<Record<string, string>>({});
  const isPromptEmpty = prompt.trim().length === 0;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedResult = selectedTask?.resultImages[selectedResultIndex];
  const selectedImageAUrl = selectedTask?.imageAPath ? imageUrls[selectedTask.imageAPath] : undefined;
  const selectedImageBUrl = selectedTask?.imageBPath ? imageUrls[selectedTask.imageBPath] : undefined;
  const selectedResultUrl = selectedResult ? imageUrls[selectedResult] : undefined;
  const runningCount = tasks.filter((task) => task.status === "uploading" || task.status === "running").length;
  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id));
  const selectedExportableCount = selectedTasks.filter(
    (task) => task.status === "success" && task.resultImages.length > 0
  ).length;
  const allExportableTasks = tasks.filter((task) => task.status === "success" && task.resultImages.length > 0);
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

    const generateType = getGenerateTypeByValue(selectedType);
    const trimmedPrompt = prompt.trim();

    if (!generateType) {
      setFormError("请选择有效的生成类型。");
      return undefined;
    }

    if (!imageA || !imageB) {
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
      imageBPath: imageB.path,
      prompt: trimmedPrompt
    });
  }

  function handleCreateTask() {
    const task = buildTaskFromInput();

    if (!task) {
      return;
    }

    enqueueTask(task);
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

  function enqueueTask(task: GenerationTask) {
    setTasks((currentTasks) => [task, ...currentTasks]);
    setSelectedTaskId(task.id);
    setSelectedResultIndex(0);
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
                progress: 65,
                progressLabel: "工作流执行中，正在轮询结果",
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );

      const result = await window.appBridge.executeCozeWorkflow({
        taskId: task.id,
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
                status: "success",
                progress: 100,
                progressLabel: "生成完成",
                resultImages: result.resultImages,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
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

  React.useEffect(() => {
    window.appBridge.getCozeConfigStatus().then((status) => {
      setConfigReady(status.isReady);
      setTaskConcurrency(status.taskConcurrency || 2);
    });
  }, []);

  React.useEffect(() => {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  React.useEffect(() => {
    if (!queueMessage) {
      return;
    }

    const timer = window.setTimeout(() => setQueueMessage(undefined), 2500);

    return () => window.clearTimeout(timer);
  }, [queueMessage]);

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
      ...selectedTask.resultImages
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
    return () => {
      if (imageA) {
        URL.revokeObjectURL(imageA.previewUrl);
      }

      if (imageB) {
        URL.revokeObjectURL(imageB.previewUrl);
      }
    };
  }, [imageA, imageB]);

  return (
    <main className="app-shell">
      <section className="panel input-panel">
        <h1>批量生图工作台</h1>
        <p>上传两张参考图，选择生成类型，输入一句话后生成图片。</p>
        {configReady === false ? (
          <p className="config-warning">Coze Token 或 Workflow ID 尚未配置。</p>
        ) : null}
        <div className="input-stack">
          <label className="field">
            <span className="field__label">生成类型</span>
            <select
              className="select"
              value={selectedType}
              onChange={(event) => setSelectedType(Number(event.currentTarget.value))}
            >
              {enabledTypes.map((type) => (
                <option key={type.key} value={type.type}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <ImageInput
            label="图 A"
            image={imageA}
            onChange={handleImageChange(setImageA)}
            onPreview={(image) => setFullscreenPreview({ imageUrl: image.previewUrl, imagePath: image.path, canDownload: false })}
          />
          <ImageInput
            label="图 B"
            image={imageB}
            onChange={handleImageChange(setImageB)}
            onPreview={(image) => setFullscreenPreview({ imageUrl: image.previewUrl, imagePath: image.path, canDownload: false })}
          />
          <label className="field">
            <span className="field__label">生成描述</span>
            <textarea
              className="textarea"
              value={prompt}
              rows={4}
              placeholder="用一句话描述想要生成的图片"
              onChange={(event) => setPrompt(event.currentTarget.value)}
            />
            {isPromptEmpty ? <span className="field__hint">生成前需要填写描述。</span> : null}
          </label>
          {formError ? <p className="form-error">{formError}</p> : null}
          <button className="primary-button" type="button" onClick={handleCreateTask}>
            创建任务
          </button>
        </div>
      </section>
      <section className="panel queue-panel">
        <h2>任务队列</h2>
        <div className="queue-controls">
          {isQueuePaused ? (
            <button className="secondary-button" type="button" onClick={handleResumeQueue}>
              继续调度
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={handlePauseQueue}>
              暂停调度
            </button>
          )}
          <button
            className="secondary-button"
            type="button"
            disabled={!tasks.some((task) => task.status === "failed")}
            onClick={handleRetryFailedTasks}
          >
            重试失败
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={allExportableTasks.length === 0}
            onClick={selectAllExportableTasks}
          >
            {hasSelectedAllExportableTasks ? "取消全选成功" : "全选成功"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={selectedTaskIds.size > 0 ? selectedExportableCount === 0 : allExportableTasks.length === 0}
            onClick={() => void exportTasks(selectedTaskIds.size > 0 ? selectedTasks : tasks)}
          >
            {selectedTaskIds.size > 0 ? `导出 (${selectedExportableCount})` : "导出"}
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={selectedTaskIds.size === 0 && !selectedTask}
            onClick={() => deleteTasks(selectedTaskIds.size > 0 ? [...selectedTaskIds] : selectedTask ? [selectedTask.id] : [])}
          >
            {selectedTaskIds.size > 0 ? `删除 (${selectedTaskIds.size})` : "删除当前"}
          </button>
        </div>
        <p className="queue-summary">
          运行中 {runningCount} 个，等待中 {pendingCount} 个，并发上限 {taskConcurrency}
        </p>
        {queueMessage ? <p className="export-message">{queueMessage}</p> : null}
        <div className="task-list">
          {tasks.length === 0 ? (
            <p>暂无任务。</p>
          ) : (
            tasks.map((task) => (
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
                      alt="Generated result"
                    />
                  </button>
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
          </div>
        )}
      </section>
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
