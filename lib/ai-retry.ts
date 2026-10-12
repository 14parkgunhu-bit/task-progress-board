// Design Ref: §6.3 재시도 규칙 — 순수 로직(테스트용으로 서버 전용 코드와 분리)
// 1회차 실패(시간 초과·네트워크·429·5xx·검증 실패) → 즉시 1회만 재시도.
// 429를 뺀 4xx(키 오류 등)는 다시 해도 소용없으므로 재시도하지 않는다.
// 두 번 모두 실패하면 "마지막 시도의 원인"으로 알린다.
import { AI_MAX_ATTEMPTS } from "./limits.ts";

/** AI 관련 오류 코드 (DESIGN 6.1) */
export type AiErrorCode = "AI_TIMEOUT" | "AI_FAILED" | "AI_INVALID";

export type AttemptResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: AiErrorCode; retryable: boolean };

export type RetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; code: AiErrorCode; attempts: number };

/** AI 제공자 HTTP 응답 코드가 재시도할 만한 실패인지 (429·5xx만) */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** attempt를 최대 maxAttempts번 실행한다. 재시도할 수 없는 실패면 바로 멈춘다. */
export async function runWithRetry<T>(
  attempt: (attemptNumber: number) => Promise<AttemptResult<T>>,
  maxAttempts: number = AI_MAX_ATTEMPTS,
): Promise<RetryResult<T>> {
  let last: AttemptResult<T> = { ok: false, code: "AI_FAILED", retryable: false };
  for (let n = 1; n <= maxAttempts; n += 1) {
    last = await attempt(n);
    if (last.ok) return { ok: true, value: last.value, attempts: n };
    if (!last.retryable) return { ok: false, code: last.code, attempts: n };
  }
  return { ok: false, code: last.ok ? "AI_FAILED" : last.code, attempts: maxAttempts };
}
