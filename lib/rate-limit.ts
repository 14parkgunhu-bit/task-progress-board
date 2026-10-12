// Design Ref: §7 "호출 제한" — 순수 로직 (테스트용으로 서버 전용 코드와 분리)
// 접속자별로 AI 호출 시각을 기억해 두고, 1분 5회·최근 24시간 50회를 넘지 않게 한다.
// 입력 검사를 통과해 실제로 AI를 부를 요청만 1회로 센다(자동 재시도는 같은 1회). (PRD 7장 ④)
import { RATE_LIMIT_PER_DAY, RATE_LIMIT_PER_MINUTE } from "./limits.ts";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/** 접속자별 호출 시각 기록 (밀리초) */
export type RateLimitStore = Map<string, number[]>;

/**
 * 이번 호출을 허용할지 판단하고, 허용하면 기록한다.
 * 막힌 경우 몇 초 뒤에 다시 시도할 수 있는지 알려준다.
 */
export function takeRateLimit(store: RateLimitStore, key: string, now: number): RateLimitResult {
  // 24시간이 지난 기록은 버린다
  const recent = (store.get(key) ?? []).filter((time) => now - time < DAY_MS);
  const lastMinute = recent.filter((time) => now - time < MINUTE_MS);

  if (lastMinute.length >= RATE_LIMIT_PER_MINUTE) {
    store.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((MINUTE_MS - (now - lastMinute[0])) / 1000) };
  }
  if (recent.length >= RATE_LIMIT_PER_DAY) {
    store.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((DAY_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  store.set(key, recent);
  return { ok: true };
}

/** 기록이 너무 많아지면 오래된 접속자부터 지운다 (서버 메모리 보호) */
export function pruneRateLimitStore(store: RateLimitStore, now: number, maxKeys = 10_000): void {
  for (const [key, times] of store) {
    if (times.every((time) => now - time >= DAY_MS)) store.delete(key);
  }
  while (store.size > maxKeys) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}
