// Design Ref: §3.1·§7 "입력 길이" — 입력 검사(화면·서버 공용 순수 함수)
// 글자 수는 화면에 보이는 문자 하나를 1자로 센다(이모지도 1자).
import { diffDays, isValidDateString } from "./dates.ts";
import {
  MAX_MEMO_LENGTH,
  MAX_STEP_TITLE_LENGTH,
  MAX_TASK_TITLE_LENGTH,
} from "./limits.ts";
import type { DateString } from "./types.ts";

/** 문자 단위 글자 수 */
export function countChars(text: string): number {
  return [...text].length;
}

export type TaskInput = { title: string; dueDate: string; memo: string };
export type TaskInputErrors = Partial<Record<keyof TaskInput, string>>;

/** 업무 입력 검사: 업무명 1~50자, 마감일 필수·올바른 날짜, 메모 0~1,000자. 앞뒤 공백은 지운 뒤 센다. */
export function validateTaskInput(input: TaskInput): {
  ok: boolean;
  errors: TaskInputErrors;
  value: TaskInput;
} {
  const value: TaskInput = {
    title: input.title.trim(),
    dueDate: input.dueDate.trim(),
    memo: input.memo.trim(),
  };
  const errors: TaskInputErrors = {};
  const titleLength = countChars(value.title);
  if (titleLength === 0) errors.title = "업무명을 입력해주세요.";
  else if (titleLength > MAX_TASK_TITLE_LENGTH)
    errors.title = `업무명은 ${MAX_TASK_TITLE_LENGTH}자까지 쓸 수 있습니다.`;
  if (!isValidDateString(value.dueDate)) errors.dueDate = "마감일을 올바르게 입력해주세요.";
  if (countChars(value.memo) > MAX_MEMO_LENGTH)
    errors.memo = `메모는 ${MAX_MEMO_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있습니다.`;
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** 할 일 제목 검사: 앞뒤 공백을 지우고 1~30자. 문제없으면 null, 있으면 안내 문구. */
export function validateStepTitle(title: string): string | null {
  const length = countChars(title.trim());
  if (length === 0) return "할 일을 입력해주세요.";
  if (length > MAX_STEP_TITLE_LENGTH)
    return `할 일은 ${MAX_STEP_TITLE_LENGTH}자까지 쓸 수 있습니다.`;
  return null;
}

/**
 * 권장 완료일 검사: 오늘부터 업무 마감일까지(둘 다 포함).
 * 빈 값은 "선택 안 함"으로 보고 통과한다. 문제없으면 null, 있으면 안내 문구.
 */
export function validateStepDueDate(
  dueDate: string | undefined,
  today: DateString,
  taskDueDate: DateString,
): string | null {
  if (dueDate === undefined || dueDate === "") return null;
  if (!isValidDateString(dueDate)) return "날짜를 올바르게 입력해주세요.";
  if (diffDays(today, dueDate) < 0) return "권장 완료일은 오늘 이후여야 합니다.";
  if (diffDays(dueDate, taskDueDate) < 0) return "권장 완료일은 업무 마감일을 넘을 수 없습니다.";
  return null;
}
