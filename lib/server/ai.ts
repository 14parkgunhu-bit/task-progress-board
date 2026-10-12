import "server-only";

// Design Ref: §6.3·§7 — 서버 전용: OpenAI 호출 (15초 제한, 재시도 1회)
// API 키는 여기서만 읽는다. 로그에는 오류 코드·시도 횟수·소요 시간만 남기고, 업무명·메모 본문은 남기지 않는다.
import { isRetryableStatus, runWithRetry, type AiErrorCode, type RetryResult } from "../ai-retry.ts";
import { AI_MAX_COMPLETION_TOKENS, AI_TIMEOUT_MS } from "../limits.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
/** 기본 모델 — 빠르고 JSON 응답을 지원한다. 서버 환경변수 OPENAI_MODEL로 바꿀 수 있다. */
const DEFAULT_MODEL = "gpt-4.1-mini";

export type ChatMessage = { role: "system" | "user"; content: string };

/** 서버에 API 키가 설정돼 있는지 (값은 절대 밖으로 내보내지 않는다) */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * AI에게 묻고, 응답 문장을 validate로 검사한다.
 * 검사에 실패하면 AI_INVALID로 보고 재시도 규칙을 따른다.
 */
export async function askAi<T>(options: {
  messages: ChatMessage[];
  /** true면 JSON 객체로만 답하게 한다 */
  json: boolean;
  /** 응답 문장 검사. 통과하면 쓸 값, 실패하면 null */
  validate: (content: string) => T | null;
  /** 로그용 이름 (예: "steps") */
  label: string;
}): Promise<RetryResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, code: "AI_FAILED", attempts: 0 };
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const started = Date.now();

  const result = await runWithRetry<T>(async () => {
    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: 0.2,
          max_completion_tokens: AI_MAX_COMPLETION_TOKENS,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return { ok: false, code: timedOut ? "AI_TIMEOUT" : "AI_FAILED", retryable: true };
    }
    if (!response.ok) {
      return { ok: false, code: "AI_FAILED", retryable: isRetryableStatus(response.status) };
    }
    let content: unknown;
    try {
      const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
      content = data.choices?.[0]?.message?.content;
    } catch {
      return { ok: false, code: "AI_INVALID", retryable: true };
    }
    const value = typeof content === "string" ? options.validate(content) : null;
    return value === null
      ? { ok: false, code: "AI_INVALID" as AiErrorCode, retryable: true }
      : { ok: true, value };
  });

  // 본문 없이 결과만 기록
  console.info(
    `[ai:${options.label}] ${result.ok ? "ok" : result.code} attempts=${result.attempts} ms=${Date.now() - started}`,
  );
  return result;
}
