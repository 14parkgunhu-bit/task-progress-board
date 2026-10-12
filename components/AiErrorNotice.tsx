"use client";

// Design Ref: §5.3 AiErrorNotice · §6.1 — 오류 안내 + [다시 시도] + 대체 수단 (PLAN 작업 25)
// AI 오류뿐 아니라 접근 코드·호출 횟수 초과·입력 오류에도 같은 대체 수단을 보여준다.
import type { ReactNode } from "react";

type Props = {
  code: string;
  message: string;
  retryAfterSec?: number;
  onRetry?: () => void;
  onClose: () => void;
  /** 대체 수단 (단계 쪼개기: 직접 입력칸) */
  children?: ReactNode;
};

/** 오류 코드별 안내 문구 (서버가 보낸 문구를 우선 쓰고, 상황 설명을 덧붙인다) */
function hint(code: string, retryAfterSec?: number): string | null {
  switch (code) {
    case "UNAUTHORIZED":
      return "위쪽의 [접근 코드]를 눌러 코드를 입력한 뒤 다시 시도하세요.";
    case "RATE_LIMITED":
      return retryAfterSec !== undefined
        ? `AI 호출 횟수를 넘었습니다. 약 ${formatWait(retryAfterSec)} 뒤에 다시 시도하세요.`
        : "AI 호출 횟수를 넘었습니다.";
    case "AI_TIMEOUT":
    case "AI_FAILED":
    case "AI_INVALID":
    case "NETWORK":
      return "잠시 후 [다시 시도]를 누르거나, 아래에서 할 일을 직접 입력하세요.";
    case "SERVER_CONFIG":
      return "서버 설정을 확인해야 합니다. 아래에서 할 일을 직접 입력할 수 있습니다.";
    default:
      return null;
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}분`;
  return `${Math.ceil(seconds / 3600)}시간`;
}

export default function AiErrorNotice({ code, message, retryAfterSec, onRetry, onClose, children }: Props) {
  const extra = hint(code, retryAfterSec);
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950"
    >
      <p className="font-medium text-red-800 dark:text-red-200">{message}</p>
      {extra && <p className="text-red-700 dark:text-red-300">{extra}</p>}
      <div className="flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800"
          >
            다시 시도
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          닫기
        </button>
      </div>
      {children}
    </div>
  );
}
