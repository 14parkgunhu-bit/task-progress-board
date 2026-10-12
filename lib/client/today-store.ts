// Design Ref: §3.3 — 브라우저 전용: "오늘" 날짜 구독
// 화면을 켜 둔 채 날짜가 바뀌면 진행률·상태를 다시 계산하도록, 1분마다 그리고 창으로 돌아올 때 날짜를 다시 확인한다.
import { todayString } from "../dates.ts";

const CHECK_INTERVAL_MS = 60_000;

export function subscribeToday(listener: () => void): () => void {
  const timer = window.setInterval(listener, CHECK_INTERVAL_MS);
  window.addEventListener("focus", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

export function getTodaySnapshot(): string {
  return todayString();
}

/** 서버에서 그릴 때는 날짜를 모른다(빈 문자열 = 아직 모름) */
export function getServerTodaySnapshot(): string {
  return "";
}
