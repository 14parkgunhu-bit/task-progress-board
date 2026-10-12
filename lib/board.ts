// Design Ref: §3.1 BoardData — 저장 데이터 검사(순수 함수)
// 브라우저에 저장된 값은 사용자가 고치거나 깨질 수 있으므로, 불러올 때 형태를 하나하나 확인한다.
import { isValidDateString } from "./dates.ts";
import { MAX_STEPS_PER_TASK, MAX_TASKS } from "./limits.ts";
import { BOARD_SCHEMA_VERSION } from "./types.ts";
import type { BoardData, Step, Task } from "./types.ts";

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
    typeof value.title === "string" &&
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
    typeof value.title === "string" &&
    isValidDateString(value.dueDate) &&
    typeof value.memo === "string" &&
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
