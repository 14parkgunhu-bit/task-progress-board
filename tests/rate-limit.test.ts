// Design Ref: §8.3 #3 — 호출 횟수 제한 점검 (1분 5회 · 최근 24시간 50회)
import assert from "node:assert/strict";
import { test } from "node:test";
import { pruneRateLimitStore, takeRateLimit, type RateLimitStore } from "../lib/rate-limit.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

test("1분 안에 5번까지 허용, 6번째는 막고 남은 시간을 알려준다", () => {
  const store: RateLimitStore = new Map();
  for (let i = 0; i < 5; i += 1) assert.deepEqual(takeRateLimit(store, "ip", i * 1000), { ok: true });
  const blocked = takeRateLimit(store, "ip", 10_000);
  assert.deepEqual(blocked, { ok: false, retryAfterSec: 50 }); // 첫 호출(0초)로부터 1분이 지나야 함
  assert.deepEqual(takeRateLimit(store, "ip", MINUTE), { ok: true }); // 1분이 지나면 다시 허용
});

test("막힌 요청은 횟수로 세지 않는다", () => {
  const store: RateLimitStore = new Map();
  for (let i = 0; i < 5; i += 1) takeRateLimit(store, "ip", 0);
  takeRateLimit(store, "ip", 1000);
  takeRateLimit(store, "ip", 2000);
  assert.equal(store.get("ip")?.length, 5);
});

test("접속자마다 따로 센다", () => {
  const store: RateLimitStore = new Map();
  for (let i = 0; i < 5; i += 1) takeRateLimit(store, "a", 0);
  assert.deepEqual(takeRateLimit(store, "b", 0), { ok: true });
});

test("최근 24시간 50회를 넘으면 막고, 24시간이 지나면 다시 허용", () => {
  const store: RateLimitStore = new Map();
  for (let i = 0; i < 50; i += 1) assert.deepEqual(takeRateLimit(store, "ip", i * 10 * MINUTE), { ok: true });
  const now = 50 * 10 * MINUTE;
  const blocked = takeRateLimit(store, "ip", now);
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 24 * 3600);
  assert.deepEqual(takeRateLimit(store, "ip", 24 * HOUR), { ok: true }); // 첫 기록(0시)이 24시간 지남
});

test("오래된 기록 정리", () => {
  const store: RateLimitStore = new Map([["old", [0]], ["new", [25 * HOUR]]]);
  pruneRateLimitStore(store, 25 * HOUR);
  assert.deepEqual([...store.keys()], ["new"]);
});

test("틀린 접근 코드: 10분에 10회를 넘으면 막고, 확인만으로는 횟수가 늘지 않는다 (SEC-001)", async () => {
  const { ACCESS_FAILURE_RULES, checkLimit, recordHit } = await import("../lib/rate-limit.ts");
  const store: RateLimitStore = new Map();
  for (let i = 0; i < 10; i += 1) {
    assert.deepEqual(checkLimit(store, "ip", i * 1000, ACCESS_FAILURE_RULES), { ok: true });
    recordHit(store, "ip", i * 1000);
  }
  const blocked = checkLimit(store, "ip", 10_000, ACCESS_FAILURE_RULES);
  assert.deepEqual(blocked, { ok: false, retryAfterSec: 590 }); // 첫 실패(0초)로부터 10분
  assert.equal(store.get("ip")?.length, 10);
  assert.deepEqual(checkLimit(store, "ip", 10 * MINUTE, ACCESS_FAILURE_RULES), { ok: true });
});

test("접속자 키: IPv4 그대로, IPv4 섞인 IPv6는 IPv4로, IPv6는 /64로 묶는다 (SEC-002)", async () => {
  const { clientKeyFromIp } = await import("../lib/rate-limit.ts");
  assert.equal(clientKeyFromIp(" 203.0.113.7 "), "203.0.113.7");
  assert.equal(clientKeyFromIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(clientKeyFromIp("2001:db8:abcd:12:1::5"), "2001:db8:abcd:12::/64");
  assert.equal(clientKeyFromIp("2001:0db8:abcd:0012:ffff:1:2:3"), "2001:db8:abcd:12::/64");
  assert.equal(clientKeyFromIp("[2001:db8::1]"), "2001:db8:0:0::/64");
  assert.equal(clientKeyFromIp(""), "unknown");
});
