import "server-only";

// Design Ref: §7 — 서버 전용: 접근 코드 확인 + 호출 횟수 제한 (PLAN 작업 26~27, 보안 점검 반영)
// 검사 순서: 접근 코드(틀린 시도 10분 10회 제한) → 입력 검사(각 API) → 호출 제한(실제로 AI를 부를 때만 1회 차감)
import { createHash, timingSafeEqual } from "node:crypto";
import {
  ACCESS_FAILURE_RULES,
  AI_CALL_RULES,
  checkLimit,
  clientKeyFromIp,
  pruneRateLimitStore,
  recordHit,
  takeRateLimit,
  type RateLimitStore,
} from "../rate-limit.ts";
import { errorResponse } from "./http.ts";

/** 접속자별 기록 — 서버 인스턴스 메모리. (인스턴스마다 따로 세어질 수 있어 접근 코드·월 사용 한도로 보완: DESIGN 7장) */
const aiCalls: RateLimitStore = new Map();
const accessFailures: RateLimitStore = new Map();
let lastPrune = 0;

function pruneIfNeeded(now: number): void {
  if (now - lastPrune < 60_000) return;
  pruneRateLimitStore(aiCalls, now);
  pruneRateLimitStore(accessFailures, now);
  lastPrune = now;
}

/** 길이가 달라도 시간 차이로 정보가 새지 않게, 해시끼리 고정 시간 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * 접속자 구분 키. Vercel은 x-forwarded-for 첫 값에 실제 접속자 IP를 넣는다.
 * (Vercel이 아닌 곳에 직접 띄우면 이 헤더를 위조할 수 있으니 앞단 프록시가 덮어쓰게 해야 한다 — SEC-002)
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : (request.headers.get("x-real-ip") ?? "");
  return clientKeyFromIp(ip);
}

/**
 * 접근 코드 확인. 통과하면 null, 막으면 오류 응답.
 * - 서버에 APP_ACCESS_CODE가 없으면: 개발 환경에서는 검사를 건너뛰고, 배포 환경에서는 모든 AI 요청을 막는다.
 * - 틀린 시도가 10분에 10회를 넘으면 잠시 막는다(맞는 코드여도). (SEC-001)
 * - 앞뒤 공백은 양쪽 모두 지우고 비교한다(Vercel에 붙여 넣다 들어간 공백·줄바꿈 대비 — SEC-009).
 * - 값은 로그·응답 어디에도 내보내지 않는다.
 */
export function checkAccessCode(request: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE?.trim();
  if (!expected) {
    return process.env.NODE_ENV === "production" ? errorResponse("SERVER_CONFIG") : null;
  }
  const now = Date.now();
  pruneIfNeeded(now);
  const key = clientKey(request);
  const blocked = checkLimit(accessFailures, key, now, ACCESS_FAILURE_RULES);
  if (!blocked.ok) {
    return errorResponse("RATE_LIMITED", {
      message: "접근 코드를 너무 많이 틀렸습니다. 잠시 후 다시 시도해주세요.",
      retryAfterSec: blocked.retryAfterSec,
    });
  }
  const given = request.headers.get("x-access-code")?.trim() ?? "";
  if (given !== "" && safeEqual(given, expected)) return null;
  recordHit(accessFailures, key, now);
  return errorResponse("UNAUTHORIZED");
}

/** 호출 횟수 1회 차감. 통과하면 null, 넘으면 429 오류 응답(다시 시도까지 남은 초 포함). */
export function consumeRateLimit(request: Request): Response | null {
  const now = Date.now();
  pruneIfNeeded(now);
  const result = takeRateLimit(aiCalls, clientKey(request), now, AI_CALL_RULES);
  return result.ok ? null : errorResponse("RATE_LIMITED", { retryAfterSec: result.retryAfterSec });
}
