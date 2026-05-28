# SDD Task List

This task list is organized by user story. Work should proceed one task at a time. Only the current active task should be implemented before moving to the next one.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Phase 1: Product Skeleton

### Task 01: Create Desktop App Skeleton

- Status: `[x]`
- User stories: Foundation for all stories
- Goal: Create the Electron + React + TypeScript application skeleton.
- Acceptance criteria:
  - The app can start locally.
  - A blank main window is rendered.
  - Main process and renderer process are separated.
  - Project has basic scripts for development and build.

### Task 02: Define Generation Type Configuration

- Status: `[x]`
- User stories: US-02, US-15
- Goal: Add a central generation type configuration with current type `1`.
- Acceptance criteria:
  - `物体一致性` is represented as `type = 1`.
  - The app does not map type to different workflow IDs.
  - Adding future types only requires extending configuration.

### Task 03: Define Task Domain Model

- Status: `[x]`
- User stories: US-04, US-08, US-09, US-10, US-15
- Goal: Add shared TypeScript models for generation tasks and task statuses.
- Acceptance criteria:
  - Task model includes type, two image paths, prompt, status, result images, error message, and timestamps.
  - Task status supports pending, uploading, running, success, failed, and cancelled.
  - Redo task relationship can be recorded.

## Phase 2: Single Generation Flow

### Task 04: Build Image Upload Inputs

- Status: `[x]`
- User stories: US-01
- Goal: Build two image upload controls.
- Acceptance criteria:
  - User can select image A.
  - User can select image B.
  - User can replace each selected image.
  - Selected images show thumbnails.

### Task 05: Build Generation Type Selector

- Status: `[x]`
- User stories: US-02
- Goal: Add type selector to the input panel.
- Acceptance criteria:
  - User can see `物体一致性`.
  - The selected value produces `type = 1`.
  - The selector is data-driven from generation type configuration.

### Task 06: Build Prompt Input

- Status: `[x]`
- User stories: US-03
- Goal: Add a prompt input for one sentence.
- Acceptance criteria:
  - User can enter and edit prompt text.
  - Empty prompt is rejected before generation.
  - Prompt is stored on the task.

### Task 07: Create Single Task From Input

- Status: `[x]`
- User stories: US-04
- Goal: Convert the current form input into a generation task.
- Acceptance criteria:
  - The app validates both images, type, and prompt.
  - A task is created with status `pending`.
  - The task appears in the queue.

### Task 08: Add Coze API Configuration

- Status: `[x]`
- User stories: US-14
- Goal: Provide local configuration for Coze token and workflow ID.
- Acceptance criteria:
  - Token and workflow ID can be configured outside renderer source code.
  - Missing configuration produces a clear error.
  - Renderer never directly reads the raw token.

### Task 09: Implement Coze Image Upload Client

- Status: `[x]`
- User stories: US-04
- Goal: Upload local images to Coze from the main process.
- Acceptance criteria:
  - Image A uploads and returns a Coze file ID.
  - Image B uploads and returns a Coze file ID.
  - Upload failure marks the task as failed with an error message.

### Task 10: Implement Coze Workflow Execution

- Status: `[x]`
- User stories: US-04
- Goal: Call the shared Coze workflow.
- Acceptance criteria:
  - The same workflow ID is used for all types.
  - Request includes `image1`, `image2`, `prompt`, and `type`.
  - Type `1` is passed for `物体一致性`.
  - Failure marks the task as failed with an error message.

### Task 11: Persist Generated Results Locally

- Status: `[x]`
- User stories: US-12
- Goal: Save generated image files to local storage.
- Acceptance criteria:
  - Successful result images are saved locally.
  - Task stores local result image paths.
  - The app can reload saved results after restart.

### Task 12: Build Result Preview

- Status: `[x]`
- User stories: US-05
- Goal: Show generated results in the preview panel.
- Acceptance criteria:
  - User can select a completed task.
  - The main result image is displayed.
  - Multiple result images can be switched through thumbnails.

## Phase 3: Redo Flow

### Task 13: Redo With Same Inputs

- Status: `[x]`
- User stories: US-06
- Goal: Create a new task from an existing task using the same inputs.
- Acceptance criteria:
  - Redo keeps type, image A, image B, and prompt.
  - Redo creates a new task.
  - New task records `retryFromTaskId`.

### Task 14: Edit Prompt And Redo

- Status: `[x]`
- User stories: US-07
- Goal: Allow prompt modification before redo.
- Acceptance criteria:
  - User can edit prompt for redo.
  - Original task is not overwritten.
  - New task uses edited prompt and same source images.

## Phase 4: Batch Queue

### Task 15: Add Queue Execution Engine

- Status: `[x]`
- User stories: US-08
- Goal: Execute multiple pending tasks through a queue.
- Acceptance criteria:
  - Multiple tasks can be queued.
  - Queue processes tasks in order.
  - Concurrency can be limited.

### Task 16: Show Task Status

- Status: `[x]`
- User stories: US-09
- Goal: Display task state transitions in the queue.
- Acceptance criteria:
  - User can see pending, uploading, running, success, failed, and cancelled states.
  - Status updates during generation.
  - Failed tasks show error reason.

### Task 17: Retry Failed Tasks

- Status: `[x]`
- User stories: US-10
- Goal: Allow failed tasks to be retried.
- Acceptance criteria:
  - User can retry one failed task.
  - User can retry multiple failed tasks.
  - Retry creates new execution without losing original failure info.

### Task 18: Pause And Resume Queue

- Status: `[x]`
- User stories: US-11
- Goal: Allow queue execution control.
- Acceptance criteria:
  - User can pause pending task execution.
  - User can resume paused queue.
  - Running task is allowed to finish unless cancellation is added later.

## Phase 5: Export And Extension

### Task 19: Export Generated Results

- Status: `[x]`
- User stories: US-13
- Goal: Export all selected or successful generated results.
- Acceptance criteria:
  - User can export one task result.
  - User can export all successful task results.
  - Exported files use predictable names.

### Task 20: Add Local Task Persistence

- Status: `[x]`
- User stories: US-08, US-09, US-12
- Goal: Persist tasks and results across app restarts.
- Acceptance criteria:
  - Tasks are saved locally.
  - App reloads previous tasks on startup.
  - Result image paths remain usable after restart.

### Task 21: Validate Type Extension Path

- Status: `[x]`
- User stories: US-15
- Goal: Prove future type expansion works without changing workflow routing.
- Acceptance criteria:
  - A disabled sample type can be added in config.
  - UI only shows enabled types.
  - Workflow client still receives selected `type` as an input parameter.

## Current Task

Current active task: All SDD tasks complete.
