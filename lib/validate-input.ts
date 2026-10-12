// Design Ref: §3.1·§7 "입력 길이" — 입력 검사(화면·서버 공용 순수 함수)
// 글자 수는 화면에 보이는 문자 하나를 1자로 센다(여러 코드로 된 이모지도 1자).
import { diffDays, isValidDateString } from "./dates.ts";
import {
  MAX_MEMO_LENGTH,
  MAX_STEP_TITLE_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  MIN_TASK_DUE_DATE,
} from "./limits.ts";
import type { DateString } from "./types.ts";

// 화면에 보이는 글자 단위로 나누는 도구 (가족 이모지 👨‍👩‍👧처럼 여러 코드로 된 글자도 1자)
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ko", { granularity: "grapheme" })
    : null;

/** 화면에 보이는 글자 단위로 나눈 목록 (요약 업무명 줄이기에도 쓴다) */
export function splitChars(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : [...text];
}

/** 화면에 보이는 글자 단위 글자 수 */
export function countChars(text: string): number {
  return splitChars(text).length;
}

// 줄바꿈·탭 같은 제어 문자 (한 줄짜리 이름에는 넣을 수 없다 — 요약 줄 수가 늘어나는 것을 막는다)
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

/** 한 줄짜리 이름(업무명·할 일 제목)으로 쓸 수 없는 문자가 있는지 */
export function hasLineBreakOrControl(text: string): boolean {
  return CONTROL_CHARS.test(text);
}

/**
 * 한 줄짜리 이름 검사: 앞뒤 공백을 지운 뒤 1~max자, 줄바꿈·제어 문자 없음.
 * 화면 입력·저장 데이터·백업 복원·요약 API가 모두 이 기준을 쓴다.
 */
export function isSingleLineName(value: unknown, max: number): value is string {
  if (typeof value !== "string" || hasLineBreakOrControl(value)) return false;
  const length = countChars(value.trim());
  return length >= 1 && length <= max;
}

export type TaskInput = { title: string; dueDate: string; memo: string };
export type TaskInputErrors = Partial<Record<keyof TaskInput, string>>;

/** 업무 입력 검사: 업무명 1~50자, 마감일 필수·허용 시작일 이후, 메모 0~1,000자. 앞뒤 공백은 지운 뒤 센다. */
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
  else if (hasLineBreakOrControl(value.title)) errors.title = "업무명에는 줄바꿈을 넣을 수 없습니다.";
  else if (titleLength > MAX_TASK_TITLE_LENGTH)
    errors.title = `업무명은 ${MAX_TASK_TITLE_LENGTH}자까지 쓸 수 있습니다.`;
  if (!isValidDateString(value.dueDate)) errors.dueDate = "마감일을 올바르게 입력해주세요.";
  else if (value.dueDate < MIN_TASK_DUE_DATE)
    errors.dueDate = `마감일은 ${MIN_TASK_DUE_DATE.slice(0, 4)}년부터 선택할 수 있습니다.`;
  if (countChars(value.memo) > MAX_MEMO_LENGTH)
    errors.memo = `메모는 ${MAX_MEMO_LENGTH.toLocaleString("ko-KR")}자까지 쓸 수 있습니다.`;
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** 할 일 제목 검사: 앞뒤 공백을 지우고 1~30자. 문제없으면 null, 있으면 안내 문구. */
export function validateStepTitle(title: string): string | null {
  const length = countChars(title.trim());
  if (length === 0) return "할 일을 입력해주세요.";
  if (hasLineBreakOrControl(title)) return "할 일에는 줄바꿈을 넣을 수 없습니다.";
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
