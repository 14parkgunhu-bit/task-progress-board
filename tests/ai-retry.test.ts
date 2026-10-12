// Design Ref: §6.3 — 재시도 규칙 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetryableStatus, runWithRetry, type AttemptResult } from "../lib/ai-retry.ts";

/** 정해 둔 결과를 차례로 돌려주는 가짜 시도 */
function scripted<T>(results: AttemptResult<T>[]) {
  let calls = 0;
  return {
    attempt: async () => results[calls++],
    calls: () => calls,
  };
}

test("첫 시도 성공이면 1번만 부른다", async () => {
  const s = scripted([{ ok: true, value: "답" }]);
  assert.deepEqual(await runWithRetry(s.attempt), { ok: true, value: "답", attempts: 1 });
  assert.equal(s.calls(), 1);
});

test("시간 초과 후 재시도 성공", async () => {
  const s = scripted<string>([{ ok: false, code: "AI_TIMEOUT", retryable: true }, { ok: true, value: "답" }]);
  assert.deepEqual(await runWithRetry(s.attempt), { ok: true, value: "답", attempts: 2 });
});

test("두 번 모두 실패하면 마지막 시도의 원인으로 알린다 (최대 2번)", async () => {
  const s = scripted<string>([
    { ok: false, code: "AI_TIMEOUT", retryable: true },
    { ok: false, code: "AI_INVALID", retryable: true },
    { ok: true, value: "세 번째는 부르면 안 됨" },
  ]);
  assert.deepEqual(await runWithRetry(s.attempt), { ok: false, code: "AI_INVALID", attempts: 2 });
  assert.equal(s.calls(), 2);
});

test("재시도할 수 없는 실패(키 오류 등)는 바로 멈춘다", async () => {
  const s = scripted<string>([{ ok: false, code: "AI_FAILED", retryable: false }, { ok: true, value: "x" }]);
  assert.deepEqual(await runWithRetry(s.attempt), { ok: false, code: "AI_FAILED", attempts: 1 });
});

test("재시도 대상 HTTP 코드는 429와 5xx뿐", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
});
