// Design Ref: §4.3 "사실 검사 방법" — AI 요약 형식 검사 + 기본 요약과 줄 단위 비교 (PRD must 2)
// AI 응답을 줄로 나눠 빈 줄을 빼고, 각 줄을 정리(normalizeLine)한 뒤
// 정답(앱이 만든 기본 요약)과 줄 수·순서·내용이 완전히 같은지 비교한다.
import { SUMMARY_MAX_LINE_LENGTH, SUMMARY_MAX_LINES } from "./limits.ts";
import { normalizeLine } from "./summary.ts";
import { countChars } from "./validate-input.ts";

/** AI 응답(JSON `{"lines":[...]}` 또는 줄바꿈 문장)에서 줄 목록을 꺼낸다. */
function extractLines(content: string): string[] | null {
  let raw: unknown = content;
  try {
    raw = JSON.parse(content);
  } catch {
    // JSON이 아니면 문장 그대로 줄바꿈으로 나눈다
  }
  let lines: unknown[];
  if (typeof raw === "string") lines = raw.split(/\r?\n/);
  else if (typeof raw === "object" && raw !== null && Array.isArray((raw as { lines?: unknown }).lines))
    lines = (raw as { lines: unknown[] }).lines;
  else return null;
  if (!lines.every((line) => typeof line === "string")) return null;
  return (lines as string[]).flatMap((line) => line.split(/\r?\n/)).filter((line) => line.trim() !== "");
}

/**
 * AI 요약을 검사한다. 통과하면 정리한 줄 목록, 하나라도 어긋나면 null.
 * - 형식: 최대 5줄, 한 줄 60자 이내
 * - 사실: 정답 줄과 줄 수·순서·내용(건수·업무명·상태·진행률·남은 할 일·마감일)이 모두 같음
 */
export function checkSummary(content: string, expected: readonly string[]): string[] | null {
  const lines = extractLines(content);
  if (!lines) return null;
  const normalized = lines.map(normalizeLine);
  if (normalized.length === 0 || normalized.length > SUMMARY_MAX_LINES) return null;
  if (normalized.some((line) => countChars(line) > SUMMARY_MAX_LINE_LENGTH)) return null;
  const answer = expected.map(normalizeLine);
  if (normalized.length !== answer.length) return null;
  return normalized.every((line, index) => line === answer[index]) ? normalized : null;
}
