// Design Ref: §4.3 POST /api/summary — 진행판 전체 요약 받기 (서버 전용)
// 순서: 입력 검사 → (업무 0건이면 AI 없이 기본 요약) → 서버가 직접 계산한 기본 요약(정답)
//      → AI 호출(15초, 재시도 1회) → 형식·사실 검사 → 응답
// AI 관련 실패(시간 초과·오류·검증 실패)는 오류 대신 200 + 기본 요약(source: "fallback")으로 응답한다.
// (접근 코드·호출 제한은 PLAN 작업 26~27에서 이 앞에 들어온다)
import { checkSummary } from "@/lib/check-summary.ts";
import { isValidDateString } from "@/lib/dates.ts";
import { MAX_STEPS_PER_TASK, MAX_TASK_TITLE_LENGTH, MAX_TASKS } from "@/lib/limits.ts";
import { askAi, hasApiKey } from "@/lib/server/ai.ts";
import { errorResponse, isAcceptableToday, okResponse, readJson } from "@/lib/server/http.ts";
import { buildSummaryPrompt } from "@/lib/server/prompts.ts";
import { buildBasicSummary, summaryFacts, viewsFromCounts, type SummaryTaskInput } from "@/lib/summary.ts";
import { countChars } from "@/lib/validate-input.ts";

export const maxDuration = 40;

/** 업무 한 건 검사: 업무명 1~50자, 마감일, 0 ≤ done ≤ total ≤ 50 (정수) */
function parseTask(value: unknown): SummaryTaskInput | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string") return null;
  const title = item.title.trim();
  const length = countChars(title);
  if (length === 0 || length > MAX_TASK_TITLE_LENGTH) return null;
  if (!isValidDateString(item.dueDate)) return null;
  const { total, done } = item;
  if (typeof total !== "number" || typeof done !== "number") return null;
  if (!Number.isInteger(total) || !Number.isInteger(done)) return null;
  if (total < 0 || total > MAX_STEPS_PER_TASK || done < 0 || done > total) return null;
  return { title, dueDate: item.dueDate, total, done };
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request, 200_000);
  if (typeof body !== "object" || body === null) return errorResponse("INVALID_INPUT");
  const raw = body as Record<string, unknown>;
  if (!isAcceptableToday(raw.today)) {
    return errorResponse("INVALID_INPUT", { field: "today", message: "기기의 날짜를 확인해주세요." });
  }
  const today = raw.today;
  if (!Array.isArray(raw.tasks) || raw.tasks.length > MAX_TASKS) {
    return errorResponse("INVALID_INPUT", { field: "tasks", message: `업무는 ${MAX_TASKS}건까지 요약할 수 있습니다.` });
  }
  const tasks: SummaryTaskInput[] = [];
  for (const item of raw.tasks) {
    const task = parseTask(item);
    if (!task) return errorResponse("INVALID_INPUT", { field: "tasks" });
    tasks.push(task);
  }

  // 서버가 직접 다시 계산한 정답 (브라우저가 보낸 진행률·상태는 받지도 믿지도 않는다)
  const views = viewsFromCounts(tasks, today);
  const expected = buildBasicSummary(views);
  if (tasks.length === 0) return okResponse({ source: "basic", lines: expected });

  if (!hasApiKey()) return errorResponse("SERVER_CONFIG");

  const result = await askAi({
    label: "summary",
    json: true,
    messages: buildSummaryPrompt(summaryFacts(views)),
    validate: (content) => checkSummary(content, expected),
  });
  return result.ok
    ? okResponse({ source: "ai", lines: result.value })
    : okResponse({ source: "fallback", lines: expected, reason: result.code });
}
