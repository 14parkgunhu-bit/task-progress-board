// Design Ref: §3.1 BoardData — 저장 데이터 검사(순수 함수)
// 브라우저에 저장된 값은 사용자가 고치거나 깨질 수 있으므로, 불러올 때 형태를 하나하나 확인한다.
import { isValidDateString } from "./dates.ts";
import {
  MAX_MEMO_LENGTH,
  MAX_STEP_TITLE_LENGTH,
  MAX_STEPS_PER_TASK,
  MAX_TASK_TITLE_LENGTH,
  MAX_TASKS,
} from "./limits.ts";
import { BOARD_SCHEMA_VERSION } from "./types.ts";
import type { BoardData, Step, Task } from "./types.ts";
import { countChars } from "./validate-input.ts";

/** 문자열이고 글자 수가 min~max 안인지 */
function isTextWithin(value: unknown, min: number, max: number): value is string {
  if (typeof value !== "string") return false;
  const length = countChars(value);
  return length >= min && length <= max;
}

/** 빈 진행판 */
export function createEmptyBoard(): BoardData {
  return { schemaVersion: BOARD_SCHEMA_VERSION, revision: 0, tasks: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStep(value: unknown): value is Step {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isTextWithin(value.title, 1, MAX_STEP_TITLE_LENGTH) &&
    (value.dueDate === undefined || isValidDateString(value.dueDate)) &&
    typeof value.done === "boolean" &&
    (value.source === "ai" || value.source === "manual") &&
    typeof value.edited === "boolean"
  );
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isTextWithin(value.title, 1, MAX_TASK_TITLE_LENGTH) &&
    isValidDateString(value.dueDate) &&
    isTextWithin(value.memo, 0, MAX_MEMO_LENGTH) &&
    Array.isArray(value.steps) &&
    value.steps.length <= MAX_STEPS_PER_TASK &&
    value.steps.every(isStep) &&
    isNonNegativeInteger(value.revision) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

/**
 * 저장된 값(JSON을 읽은 결과)이 올바른 진행판인지 확인한다.
 * 올바르면 BoardData, 형태가 하나라도 어긋나면 null.
 */
export function parseBoardData(raw: unknown): BoardData | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== BOARD_SCHEMA_VERSION) return null;
  if (!isNonNegativeInteger(raw.revision)) return null;
  if (!Array.isArray(raw.tasks) || raw.tasks.length > MAX_TASKS) return null;
  if (!raw.tasks.every(isTask)) return null;
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    revision: raw.revision,
    tasks: raw.tasks,
  };
}

// ─────────────────────────────────────────────────────────────
// 진행판 조작 (순수 함수) — 원본을 바꾸지 않고 새 진행판을 돌려준다.
// 업무 내용(업무명·마감일·메모·할 일·체크)이 바뀌면 그 업무의 revision과 보드 revision을 함께 올린다.
// 늦게 도착한 AI 응답이 사용자의 수정을 덮어쓰지 않게 판단하는 기준이다. (PRD 5장 AI 응답 반영 규칙)
// ─────────────────────────────────────────────────────────────

/** 새 ID (브라우저·Node 모두 지원하는 crypto.randomUUID) */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** 업무를 더 추가할 수 있는지 (최대 100건) */
export function canAddTask(board: BoardData): boolean {
  return board.tasks.length < MAX_TASKS;
}

/** 이 업무에 할 일을 count개 더 넣을 수 있는지 (최대 50개) */
export function canAddSteps(task: Task, count = 1): boolean {
  return task.steps.length + count <= MAX_STEPS_PER_TASK;
}

/** 업무 하나를 고친다. 대상이 없으면 원래 진행판을 그대로 돌려준다. */
function modifyTask(
  board: BoardData,
  taskId: string,
  change: (task: Task) => Task,
  now: string,
): BoardData {
  let changed = false;
  const tasks = board.tasks.map((task) => {
    if (task.id !== taskId) return task;
    changed = true;
    return { ...change(task), revision: task.revision + 1, updatedAt: now };
  });
  return changed ? { ...board, revision: board.revision + 1, tasks } : board;
}

/** 업무 등록 (등록 순서 = 배열 끝에 추가). 상한이면 그대로 돌려준다. */
export function addTask(
  board: BoardData,
  input: { title: string; dueDate: string; memo: string },
  now: string,
  id: string = newId(),
): BoardData {
  if (!canAddTask(board)) return board;
  const task: Task = { id, ...input, steps: [], revision: 0, createdAt: now, updatedAt: now };
  return { ...board, revision: board.revision + 1, tasks: [...board.tasks, task] };
}

/** 업무명·마감일·메모 수정 */
export function updateTask(
  board: BoardData,
  taskId: string,
  input: { title: string; dueDate: string; memo: string },
  now: string,
): BoardData {
  return modifyTask(board, taskId, (task) => ({ ...task, ...input }), now);
}

/** 업무 삭제 */
export function deleteTask(board: BoardData, taskId: string): BoardData {
  const tasks = board.tasks.filter((task) => task.id !== taskId);
  return tasks.length === board.tasks.length
    ? board
    : { ...board, revision: board.revision + 1, tasks };
}

/** 사람이 입력한 할 일 하나 */
export type ManualStepInput = { title: string; dueDate?: string };

/**
 * 할 일 직접 추가 (여러 개 한 번에). 제목이 빈 칸은 무시한다.
 * 상한(50개)을 넘으면 아무것도 넣지 않고 그대로 돌려준다.
 */
export function addManualSteps(
  board: BoardData,
  taskId: string,
  inputs: readonly ManualStepInput[],
  now: string,
  makeId: () => string = newId,
): BoardData {
  const filled = inputs
    .map((input) => ({ title: input.title.trim(), dueDate: input.dueDate || undefined }))
    .filter((input) => input.title !== "");
  const task = board.tasks.find((item) => item.id === taskId);
  if (!task || filled.length === 0 || !canAddSteps(task, filled.length)) return board;
  const steps: Step[] = filled.map((input) => ({
    id: makeId(),
    title: input.title,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    done: false,
    source: "manual",
    edited: false,
  }));
  return modifyTask(board, taskId, (item) => ({ ...item, steps: [...item.steps, ...steps] }), now);
}

/** 할 일 제목·권장 완료일 수정. AI 제안이었던 할 일을 고치면 edited = true (PRD 3장 지표) */
export function updateStep(
  board: BoardData,
  taskId: string,
  stepId: string,
  input: ManualStepInput,
  now: string,
): BoardData {
  const title = input.title.trim();
  const dueDate = input.dueDate || undefined;
  return modifyTask(
    board,
    taskId,
    (task) => ({
      ...task,
      steps: task.steps.map((step) => {
        if (step.id !== stepId) return step;
        const changed = step.title !== title || step.dueDate !== dueDate;
        const { dueDate: _old, ...rest } = step;
        void _old;
        return {
          ...rest,
          title,
          ...(dueDate ? { dueDate } : {}),
          edited: step.edited || (step.source === "ai" && changed),
        };
      }),
    }),
    now,
  );
}

/** 할 일 체크/해제 */
export function toggleStep(board: BoardData, taskId: string, stepId: string, now: string): BoardData {
  return modifyTask(
    board,
    taskId,
    (task) => ({
      ...task,
      steps: task.steps.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step)),
    }),
    now,
  );
}

/** 할 일 삭제 */
export function deleteStep(board: BoardData, taskId: string, stepId: string, now: string): BoardData {
  return modifyTask(
    board,
    taskId,
    (task) => ({ ...task, steps: task.steps.filter((step) => step.id !== stepId) }),
    now,
  );
}

/** AI 제안을 반영할 때 한 줄 (edited: 사용자가 제안을 고쳤는지) */
export type ProposalStepInput = { title: string; dueDate?: string; edited: boolean };

/**
 * AI 제안 반영 (PRD 5장 AI 응답 반영 규칙)
 * - append(뒤에 추가): 기존 할 일(체크 포함)은 그대로 두고 뒤에 붙인다. 50개를 넘으면 반영하지 않는다.
 * - replace(바꾸기): 기존 할 일을 제안으로 바꾼다. (체크 손실 확인은 화면에서 먼저 받는다)
 * 반영된 할 일은 source = "ai".
 */
export function applyProposal(
  board: BoardData,
  taskId: string,
  inputs: readonly ProposalStepInput[],
  mode: "append" | "replace",
  now: string,
  makeId: () => string = newId,
): BoardData {
  const filled = inputs.filter((input) => input.title.trim() !== "");
  const task = board.tasks.find((item) => item.id === taskId);
  if (!task || filled.length === 0) return board;
  if (mode === "append" && !canAddSteps(task, filled.length)) return board;
  if (mode === "replace" && filled.length > MAX_STEPS_PER_TASK) return board;
  const steps: Step[] = filled.map((input) => ({
    id: makeId(),
    title: input.title.trim(),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    done: false,
    source: "ai",
    edited: input.edited,
  }));
  return modifyTask(
    board,
    taskId,
    (item) => ({ ...item, steps: mode === "append" ? [...item.steps, ...steps] : steps }),
    now,
  );
}
