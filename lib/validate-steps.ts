// Design Ref: §4.2 — AI 단계 응답 검증 (PRD must 1 서버 검증)
// - JSON으로 읽히고 status가 ok 또는 need_more_info
// - ok: steps 3~7개, title 30자 이내·"하기"로 끝남·중복 없음, dueDate 필수·오늘~업무 마감일(둘 다 포함)
// - need_more_info: question이 비어 있지 않음
import { diffDays, isValidDateString } from "./dates.ts";
import { AI_STEPS_MAX, AI_STEPS_MIN, MAX_STEP_TITLE_LENGTH } from "./limits.ts";
import type { DateString } from "./types.ts";
import { countChars } from "./validate-input.ts";

/** 추가 입력 요청 질문의 최대 글자 수 (화면이 지나치게 길어지지 않게) */
const MAX_QUESTION_LENGTH = 200;

export type ProposedStep = { title: string; dueDate: DateString };

export type StepsResponse =
  | { status: "ok"; steps: ProposedStep[] }
  | { status: "need_more_info"; question: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** AI 응답 문장을 검사한다. 규칙에 맞으면 정리한 값을, 하나라도 어긋나면 null을 돌려준다. */
export function parseStepsResponse(
  content: string,
  today: DateString,
  taskDueDate: DateString,
): StepsResponse | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  if (data.status === "need_more_info") {
    if (typeof data.question !== "string") return null;
    const question = data.question.trim();
    if (question === "" || countChars(question) > MAX_QUESTION_LENGTH) return null;
    return { status: "need_more_info", question };
  }

  if (data.status !== "ok" || !Array.isArray(data.steps)) return null;
  if (data.steps.length < AI_STEPS_MIN || data.steps.length > AI_STEPS_MAX) return null;

  const steps: ProposedStep[] = [];
  const seen = new Set<string>();
  for (const item of data.steps) {
    if (!isRecord(item) || typeof item.title !== "string") return null;
    const title = item.title.trim();
    const length = countChars(title);
    if (length === 0 || length > MAX_STEP_TITLE_LENGTH || !title.endsWith("하기")) return null;
    if (seen.has(title)) return null;
    seen.add(title);
    if (!isValidDateString(item.dueDate)) return null; // 빠져 있거나 형식이 틀리면 실패
    if (diffDays(today, item.dueDate) < 0 || diffDays(item.dueDate, taskDueDate) < 0) return null;
    steps.push({ title, dueDate: item.dueDate });
  }
  return { status: "ok", steps };
}
