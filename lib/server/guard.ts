import "server-only";

// Design Ref: §7 — 서버 전용: 접근 코드 확인 + 호출 횟수 제한 (PLAN 작업 26~27)
// 검사 순서: 접근 코드 → 입력 검사(각 API) → 호출 제한(실제로 AI를 부를 때만 1회 차감)
import { createHash, timingSafeEqual } from "node:crypto";
import { pruneRateLimitStore, takeRateLimit, type RateLimitStore } from "../rate-limit.ts";
import { errorResponse } from "./http.ts";

/** 접속자별 호출 기록 — 서버 인스턴스 메모리. (인스턴스마다 따로 세어질 수 있어 접근 코드·월 사용 한도로 보완: DESIGN 7장) */
const store: RateLimitStore = new Map();
let lastPrune = 0;

/** 길이가 달라도 시간 차이로 정보가 새지 않게, 해시끼리 고정 시간 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * 접근 코드 확인. 통과하면 null, 막으면 오류 응답.
 * - 서버에 APP_ACCESS_CODE가 없으면: 개발 환경에서는 검사를 건너뛰고, 배포 환경에서는 모든 AI 요청을 막는다.
 * - 값은 로그·응답 어디에도 내보내지 않는다.
 */
export function checkAccessCode(request: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) {
    return process.env.NODE_ENV === "production" ? errorResponse("SERVER_CONFIG") : null;
  }
  const given = request.headers.get("x-access-code") ?? "";
  return given !== "" && safeEqual(given, expected) ? null : errorResponse("UNAUTHORIZED");
}

/** 접속자 구분용 IP (Vercel은 x-forwarded-for 첫 값에 실제 접속자 IP를 넣는다) */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 호출 횟수 1회 차감. 통과하면 null, 넘으면 429 오류 응답(다시 시도까지 남은 초 포함). */
export function consumeRateLimit(request: Request): Response | null {
  const now = Date.now();
  if (now - lastPrune > 60_000) {
    pruneRateLimitStore(store, now);
    lastPrune = now;
  }
  const result = takeRateLimit(store, clientKey(request), now);
  return result.ok ? null : errorResponse("RATE_LIMITED", { retryAfterSec: result.retryAfterSec });
}
