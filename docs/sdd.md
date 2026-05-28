# Windows Batch Image Generator SDD

## 1. Product Goal

Build a Windows desktop application for batch image generation. Users upload two reference images, select a generation type, enter one prompt sentence, and generate images through one shared Coze workflow.

The first release supports only:

- Type: `1`
- Name: Object Consistency
- Chinese label: `物体一致性`

Future effects must be added as new type options. The application must continue to call the same Coze workflow. `type` is only a workflow input parameter.

## 2. Scope

### In Scope

- Upload two local images.
- Select generation type.
- Enter one prompt sentence.
- Create a generation task.
- Upload images to Coze.
- Call one Coze workflow with `image1`, `image2`, `prompt`, and `type`.
- Preview generated images.
- Redo a task.
- Redo after editing prompt.
- Queue multiple tasks.
- Show task status.
- Retry failed tasks.
- Pause and resume batch execution.
- Save generated images locally.
- Export generated results.
- Configure Coze token and workflow ID.
- Support adding more generation types later.

### Out of Scope For MVP

- Multiple Coze workflows.
- Cloud account system.
- Team collaboration.
- Built-in image editing.
- Advanced prompt optimization.
- Payment or quota management.

## 3. Core Constraint

There is only one Coze workflow.

```text
Windows App
  -> upload image A
  -> upload image B
  -> call same Coze workflow
  -> pass type as parameter
```

Example workflow parameters:

```json
{
  "image1": {
    "file_id": "coze_uploaded_file_id_1"
  },
  "image2": {
    "file_id": "coze_uploaded_file_id_2"
  },
  "prompt": "user prompt",
  "type": 1
}
```

Example workflow output:

```json
{
  "output": "generated image value or generated image list"
}
```

## 4. Recommended Technical Architecture

- Desktop shell: Electron
- UI: React + TypeScript
- Local storage: SQLite
- Local file cache: application data directory
- Main process: Coze API calls, file upload, local persistence
- Renderer process: form input, preview, queue controls

The Coze token must not be placed directly in renderer code. The renderer sends task requests to the main process through a controlled IPC interface.

## 5. Generation Types

```ts
type GenerateType = {
  type: number;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
};

const GENERATE_TYPES: GenerateType[] = [
  {
    type: 1,
    key: "object_consistency",
    name: "物体一致性",
    description: "保持主体物体一致，根据两张参考图和一句话生成新图",
    enabled: true
  }
];
```

## 6. Task Model

```ts
type TaskStatus =
  | "pending"
  | "uploading"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

type GenerationTask = {
  id: string;
  type: number;
  typeKey: string;
  imageAPath: string;
  imageBPath: string;
  prompt: string;
  status: TaskStatus;
  resultImages: string[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  retryFromTaskId?: string;
};
```

## 7. Main Screen Layout

### Left Panel: Input

- Generation type selector.
- Image A uploader.
- Image B uploader.
- Prompt input.
- Generate button.
- Add to queue button.

### Center Panel: Queue

- Task list.
- Type label.
- Thumbnail previews.
- Prompt summary.
- Status.
- Progress indicator.
- Failure reason.
- Multi-select actions.

### Right Panel: Preview

- Selected task result preview.
- Result thumbnails.
- Version history.
- Redo button.
- Edit prompt and redo.
- Export result.
- Open local folder.

## 8. User Stories

US-01: As a user, I want to upload two reference images so that the system can generate a new image from them.

US-02: As a user, I want to select a generation type so that I can tell the workflow which effect to use.

US-03: As a user, I want to enter one prompt sentence so that the generated result follows my intent.

US-04: As a user, I want to click one button to generate an image so that I do not need to understand Coze workflow details.

US-05: As a user, I want to preview generated results in the app so that I can quickly judge whether they are usable.

US-06: As a user, I want to redo a generated image so that I can get another result when I am not satisfied.

US-07: As a user, I want to edit the prompt before redo so that I can refine the result with the same source images.

US-08: As a user, I want to create multiple generation tasks so that I can process many images in a batch.

US-09: As a user, I want to see each task status so that I know which tasks are pending, running, successful, or failed.

US-10: As a user, I want to retry failed tasks so that temporary network or API failures do not break the whole batch.

US-11: As a user, I want to pause and resume batch execution so that I can control generation pace.

US-12: As a user, I want generated results to be saved locally so that I can use them later.

US-13: As a user, I want to export all generated results so that I can deliver or archive a batch.

US-14: As an app configurator, I want to configure Coze token and workflow ID so that different environments can use different credentials.

US-15: As a developer, I want to add new generation types by configuration so that future effects do not require rewriting the task system.

## 9. Success Criteria

- A user can complete one full generation from two images and one prompt.
- The app always calls the same Coze workflow.
- The request always includes `type`.
- Type `1` is available as `物体一致性`.
- Generated images can be previewed and saved.
- Failed tasks can be retried.
- Batch tasks can be queued, paused, resumed, and exported.
- New types can be added by extending generation type configuration.
