# User Stories

## US-01: Upload Two Reference Images

As a user, I want to upload two reference images so that the system can generate a new image from them.

Acceptance criteria:

- I can select image A from my computer.
- I can select image B from my computer.
- I can preview both selected images before generating.
- I can replace either image before generating.

## US-02: Select Generation Type

As a user, I want to select a generation type so that I can tell the workflow which effect to use.

Acceptance criteria:

- I can see a generation type selector.
- The first available type is `物体一致性`.
- Selecting `物体一致性` passes `type = 1`.
- The app uses the same Coze workflow regardless of selected type.

## US-03: Enter Prompt

As a user, I want to enter one prompt sentence so that the generated result follows my intent.

Acceptance criteria:

- I can enter a text prompt.
- I can edit the prompt before generating.
- I cannot start generation with an empty prompt.

## US-04: Generate Image

As a user, I want to click one button to generate an image so that I do not need to understand Coze workflow details.

Acceptance criteria:

- I can click a generate button after completing required inputs.
- The app uploads both images.
- The app calls the shared Coze workflow.
- The workflow receives `image1`, `image2`, `prompt`, and `type`.
- I see a clear success or failure result.

## US-05: Preview Results

As a user, I want to preview generated results in the app so that I can quickly judge whether they are usable.

Acceptance criteria:

- I can select a completed task.
- I can see the generated image in a preview area.
- If multiple images are returned, I can switch between them.

## US-06: Redo Generation

As a user, I want to redo a generated image so that I can get another result when I am not satisfied.

Acceptance criteria:

- I can redo a completed task.
- Redo uses the same type, images, and prompt by default.
- Redo creates a new task instead of overwriting the old result.

## US-07: Edit Prompt Before Redo

As a user, I want to edit the prompt before redo so that I can refine the result with the same source images.

Acceptance criteria:

- I can open redo with the previous prompt prefilled.
- I can change the prompt.
- The new task uses the changed prompt.
- The original task remains unchanged.

## US-08: Create Multiple Tasks

As a user, I want to create multiple generation tasks so that I can process many images in a batch.

Acceptance criteria:

- I can add a task to the queue without immediately losing current history.
- I can create more than one queued task.
- The queue can process pending tasks.

## US-09: See Task Status

As a user, I want to see each task status so that I know which tasks are pending, running, successful, or failed.

Acceptance criteria:

- Each task displays a status.
- Status changes as the task moves through upload, workflow execution, success, or failure.
- Failed tasks show a readable error message.

## US-10: Retry Failed Tasks

As a user, I want to retry failed tasks so that temporary network or API failures do not break the whole batch.

Acceptance criteria:

- I can retry one failed task.
- I can retry multiple failed tasks.
- Retry does not erase the original failure record.

## US-11: Pause And Resume Batch

As a user, I want to pause and resume batch execution so that I can control generation pace.

Acceptance criteria:

- I can pause queue execution.
- Pausing prevents new pending tasks from starting.
- I can resume the queue later.

## US-12: Save Results Locally

As a user, I want generated results to be saved locally so that I can use them later.

Acceptance criteria:

- Generated images are saved to local disk.
- Saved file paths are recorded on the task.
- Saved results remain accessible after reopening the app.

## US-13: Export Results

As a user, I want to export all generated results so that I can deliver or archive a batch.

Acceptance criteria:

- I can export one task result.
- I can export all successful task results.
- Exported files are named predictably.

## US-14: Configure Coze Credentials

As an app configurator, I want to configure Coze token and workflow ID so that different environments can use different credentials.

Acceptance criteria:

- Coze token is configurable.
- Coze workflow ID is configurable.
- Missing config produces a readable error.
- The renderer process does not directly expose the raw token.

## US-15: Extend Generation Types

As a developer, I want to add new generation types by configuration so that future effects do not require rewriting the task system.

Acceptance criteria:

- Generation types are defined in one central config.
- Enabled types appear in the UI.
- Disabled types do not appear in the UI.
- The workflow client passes selected `type` as a parameter.
- No type-specific workflow routing is introduced.
