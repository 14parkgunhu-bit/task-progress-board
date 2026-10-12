// Design Ref: §4·§6 — 브라우저 전용: 서버 API 호출
// 서버 오류(`{ error: { code, message } }`)와 네트워크 오류를 한 가지 형태로 정리해 돌려준다.

export type ApiFailure = {
  ok: false;
  /** 서버 오류 코드 (DESIGN 6.1) 또는 브라우저 쪽 "NETWORK" */
  code: string;
  message: string;
  retryAfterSec?: number;
};

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

/** 접근 코드를 붙여 POST로 JSON을 보낸다. 브라우저가 기다리는 최대 시간은 서버 재시도(15초 × 2)보다 조금 길게 둔다. */
export async function postJson<T>(
  path: string,
  body: unknown,
  accessCode: string | null,
  timeoutMs = 45_000,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessCode ? { "x-access-code": accessCode } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, code: "NETWORK", message: "서버에 연결하지 못했습니다." };
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.ok) return { ok: true, data: data as T };
  const error = (data as { error?: { code?: string; message?: string; retryAfterSec?: number } } | null)?.error;
  return {
    ok: false,
    code: error?.code ?? "AI_FAILED",
    message: error?.message ?? "요청을 처리하지 못했습니다.",
    ...(error?.retryAfterSec !== undefined ? { retryAfterSec: error.retryAfterSec } : {}),
  };
}
