// Design Ref: §8.2 — 날짜 계산 경계 사례 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcDDay,
  diffDays,
  formatDDay,
  formatMonthDay,
  isValidDateString,
  todayString,
} from "../lib/dates.ts";

test("마감까지 남은 날 수: 4일·3일·당일·하루 지남", () => {
  assert.equal(calcDDay("2026-10-16", "2026-10-12"), 4);
  assert.equal(calcDDay("2026-10-15", "2026-10-12"), 3);
  assert.equal(calcDDay("2026-10-12", "2026-10-12"), 0);
  assert.equal(calcDDay("2026-10-11", "2026-10-12"), -1);
});

test("월·연도를 넘어가도 하루 차이로 계산한다", () => {
  assert.equal(diffDays("2026-10-31", "2026-11-01"), 1);
  assert.equal(diffDays("2026-12-31", "2027-01-01"), 1);
});

test("올바른 날짜만 통과시킨다", () => {
  assert.equal(isValidDateString("2028-02-29"), true); // 윤년
  assert.equal(isValidDateString("2026-02-29"), false); // 없는 날
  assert.equal(isValidDateString("2026-04-31"), false);
  assert.equal(isValidDateString("2026-1-5"), false); // 형식 틀림
  assert.equal(isValidDateString(20261012), false); // 문자열 아님
});

test("잘못된 날짜로 계산하면 조용히 넘어가지 않고 오류를 낸다", () => {
  assert.throws(() => diffDays("2026-02-30", "2026-10-12"));
  assert.throws(() => formatMonthDay("2026/10/08"));
});

test("D-day 표기: D-3 / D-day / D+1", () => {
  assert.equal(formatDDay(3), "D-3");
  assert.equal(formatDDay(0), "D-day");
  assert.equal(formatDDay(-1), "D+1");
});

test("MM/DD 표기와 오늘 날짜", () => {
  assert.equal(formatMonthDay("2026-10-08"), "10/08");
  assert.equal(todayString(new Date(2026, 9, 12, 23, 59)), "2026-10-12");
});
