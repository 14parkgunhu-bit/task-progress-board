import "server-only";

// Design Ref: §4·§6.2 — 서버 전용: 요청 읽기·오류 응답·"오늘" 날짜 확인
import { diffDays, isValidDateString, todayString } from "../dates.ts";

/** 오류 코드 (DESIGN 6.1) */
export type ApiErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_FAILED"
  | "AI_INVALID"
  | "SERVER_CONFIG";

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  AI_TIMEOUT: 504,
  AI_FAILED: 502,
  AI_INVALID: 502,
  SERVER_CONFIG: 500,
};

const MESSAGE: Record<ApiErrorCode, string> = {
  INVALID_INPUT: "입력값을 확인해주세요.",
  UNAUTHORIZED: "접근 코드를 확인해주세요.",
  RATE_LIMITED: "잠시 후 다시 시도해주세요.",
  AI_TIMEOUT: "AI 응답을 받지 못했습니다.",
  AI_FAILED: "AI 응답을 받지 못했습니다.",
  AI_INVALID: "AI 응답을 받지 못했습니다.",
  SERVER_CONFIG: "서버 설정 오류입니다.",
};

/** 오류 응답: `{ error: { code, message, ... } }` */
export function errorResponse(
  code: ApiErrorCode,
  extra: { message?: string; retryAfterSec?: number; field?: string } = {},
): Response {
  const headers: HeadersInit = { "Cache-Control": "no-store" };
  if (extra.retryAfterSec !== undefined) headers["Retry-After"] = String(extra.retryAfterSec);
  return Response.json(
    { error: { code, message: extra.message ?? MESSAGE[code], ...extra } },
    { status: STATUS[code], headers },
  );
}

/** 성공 응답 (캐시하지 않음) */
export function okResponse(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** 요청 본문을 JSON으로 읽는다. 크기가 너무 크거나 JSON이 아니면 null. */
export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 브라우저가 보낸 "오늘"이 서버 날짜 ±1일 안인지 확인한다. (DESIGN 3.3)
 * 서버(Vercel)는 UTC라 사용자의 한국 날짜와 하루 차이가 날 수 있어 ±1일을 허용한다.
 */
export function isAcceptableToday(today: unknown, now: Date = new Date()): today is string {
  if (!isValidDateString(today)) return false;
  return Math.abs(diffDays(todayString(now), today)) <= 1;
}
