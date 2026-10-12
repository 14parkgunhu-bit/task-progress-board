// Design Ref: §7 "호출 제한" — 순수 로직 (테스트용으로 서버 전용 코드와 분리)
// 접속자별로 시각을 기억해 두고, 정해진 시간 창 안의 횟수를 넘지 않게 한다.
// - AI 호출: 1분 5회·최근 24시간 50회. 실제로 AI를 부를 요청만 1회로 센다(자동 재시도는 같은 1회). (PRD 7장 ④)
// - 틀린 접근 코드: 10분 10회. 넘으면 맞는 코드라도 잠시 막는다(무작위 대입 방지 — 보안 점검 SEC-001).
import {
  ACCESS_CODE_FAILURES_PER_10_MIN,
  RATE_LIMIT_PER_DAY,
  RATE_LIMIT_PER_MINUTE,
} from "./limits.ts";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** 시간 창 하나: windowMs 안에 max번까지 */
export type LimitRule = { windowMs: number; max: number };

/** AI 호출 제한 */
export const AI_CALL_RULES: readonly LimitRule[] = [
  { windowMs: MINUTE_MS, max: RATE_LIMIT_PER_MINUTE },
  { windowMs: DAY_MS, max: RATE_LIMIT_PER_DAY },
];

/** 틀린 접근 코드 시도 제한 */
export const ACCESS_FAILURE_RULES: readonly LimitRule[] = [
  { windowMs: 10 * MINUTE_MS, max: ACCESS_CODE_FAILURES_PER_10_MIN },
];

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/** 접속자별 기록 시각 (밀리초, 오래된 것부터) */
export type RateLimitStore = Map<string, number[]>;

function longestWindow(rules: readonly LimitRule[]): number {
  return Math.max(...rules.map((rule) => rule.windowMs));
}

/** 지금 막혀 있는지 확인만 한다(기록하지 않음). */
export function checkLimit(
  store: RateLimitStore,
  key: string,
  now: number,
  rules: readonly LimitRule[],
): RateLimitResult {
  const keep = longestWindow(rules);
  const recent = (store.get(key) ?? []).filter((time) => now - time < keep);
  store.set(key, recent);
  let wait = 0;
  for (const rule of rules) {
    const inWindow = recent.filter((time) => now - time < rule.windowMs);
    if (inWindow.length >= rule.max) {
      wait = Math.max(wait, Math.ceil((rule.windowMs - (now - inWindow[0])) / 1000));
    }
  }
  return wait > 0 ? { ok: false, retryAfterSec: wait } : { ok: true };
}

/** 한 번 기록한다. */
export function recordHit(store: RateLimitStore, key: string, now: number): void {
  const times = store.get(key) ?? [];
  times.push(now);
  store.set(key, times);
}

/** 허용되면 기록하고 ok, 막히면 기록 없이 남은 시간을 알려준다. (막힌 요청은 횟수로 세지 않는다) */
export function takeRateLimit(
  store: RateLimitStore,
  key: string,
  now: number,
  rules: readonly LimitRule[] = AI_CALL_RULES,
): RateLimitResult {
  const result = checkLimit(store, key, now, rules);
  if (result.ok) recordHit(store, key, now);
  return result;
}

/** 기록이 너무 많아지면 오래된 접속자부터 지운다 (서버 메모리 보호) */
export function pruneRateLimitStore(
  store: RateLimitStore,
  now: number,
  maxKeys = 10_000,
  keepMs = DAY_MS,
): void {
  for (const [key, times] of store) {
    if (times.every((time) => now - time >= keepMs)) store.delete(key);
  }
  while (store.size > maxKeys) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * 접속자 구분 키.
 * - IPv4는 그대로, IPv4가 섞인 IPv6("::ffff:1.2.3.4")는 IPv4로 본다.
 * - IPv6는 앞 64비트(/64) 단위로 묶는다. 한 사용자가 /64 안에서 주소를 바꿔 제한을 피하지 못하게 한다. (SEC-002)
 */
export function clientKeyFromIp(rawIp: string): string {
  const ip = rawIp.trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (ip === "") return "unknown";
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, null];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = tail === null ? 0 : 8 - headParts.length - tailParts.length;
  const groups = [...headParts, ...Array<string>(Math.max(missing, 0)).fill("0"), ...tailParts];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return ip;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
