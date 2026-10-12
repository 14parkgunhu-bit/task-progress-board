// Design Ref: §4.2 POST /api/steps — 업무를 할 일로 쪼갠 제안 받기 (서버 전용)
// 순서: 접근 코드 → 입력 검사 → 호출 제한(1회 차감) → AI 호출(15초, 재시도 1회) → 응답 검증 → 응답
import { diffDays } from "@/lib/dates.ts";
import { askAi, hasApiKey } from "@/lib/server/ai.ts";
import { checkAccessCode, consumeRateLimit } from "@/lib/server/guard.ts";
import { errorResponse, isAcceptableToday, okResponse, readJson } from "@/lib/server/http.ts";
import { buildStepsPrompt } from "@/lib/server/prompts.ts";
import { validateTaskInput } from "@/lib/validate-input.ts";
import { parseStepsResponse } from "@/lib/validate-steps.ts";

// 15초 × 최대 2번 시도를 넉넉히 감싼다 (DESIGN 6.3)
export const maxDuration = 40;

export async function POST(request: Request): Promise<Response> {
  const denied = checkAccessCode(request);
  if (denied) return denied;

  const body = await readJson(request);
  if (typeof body !== "object" || body === null) return errorResponse("INVALID_INPUT");
  const raw = body as Record<string, unknown>;

  const checked = validateTaskInput({
    title: typeof raw.title === "string" ? raw.title : "",
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : "",
    memo: typeof raw.memo === "string" ? raw.memo : "",
  });
  if (!checked.ok) {
    const field = Object.keys(checked.errors)[0];
    return errorResponse("INVALID_INPUT", { field, message: Object.values(checked.errors)[0] });
  }
  if (!isAcceptableToday(raw.today)) {
    return errorResponse("INVALID_INPUT", { field: "today", message: "기기의 날짜를 확인해주세요." });
  }
  const today = raw.today;
  const { title, dueDate, memo } = checked.value;
  if (diffDays(today, dueDate) < 0) {
    return errorResponse("INVALID_INPUT", { field: "dueDate", message: "마감일을 먼저 수정하세요." });
  }

  if (!hasApiKey()) return errorResponse("SERVER_CONFIG");
  const limited = consumeRateLimit(request);
  if (limited) return limited;

  const result = await askAi({
    label: "steps",
    json: true,
    messages: buildStepsPrompt({ title, dueDate, memo, today }),
    validate: (content) => parseStepsResponse(content, today, dueDate),
  });
  return result.ok ? okResponse(result.value) : errorResponse(result.code);
}
