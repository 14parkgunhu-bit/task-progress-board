// Design Ref: §8.2 — 진행률·완료 판정 경계 사례 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { calcProgress, countSteps, isComplete } from "../lib/progress.ts";
import type { Step } from "../lib/types.ts";

test("진행률: 반올림, 0개면 0%", () => {
  assert.equal(calcProgress(0, 0), 0);
  assert.equal(calcProgress(5, 2), 40);
  assert.equal(calcProgress(3, 1), 33);
  assert.equal(calcProgress(3, 2), 67);
  assert.equal(calcProgress(200, 1), 1);
  assert.equal(calcProgress(3, 3), 100);
});

test("미완료가 남으면 반올림 결과가 100이어도 최대 99%", () => {
  assert.equal(calcProgress(199, 198), 99);
  assert.equal(calcProgress(200, 199), 99);
  assert.equal(calcProgress(1000, 999), 99);
  assert.equal(calcProgress(50, 49), 98);
});

test("완료는 개수로 판정한다", () => {
  assert.equal(isComplete(0, 0), false);
  assert.equal(isComplete(199, 198), false);
  assert.equal(isComplete(1, 1), true);
});

test("잘못된 개수는 오류를 낸다", () => {
  assert.throws(() => calcProgress(3, 4));
  assert.throws(() => calcProgress(-1, 0));
  assert.throws(() => calcProgress(2.5, 1));
});

test("할 일 목록에서 전체·완료·남은 개수를 센다", () => {
  const step = (done: boolean): Step => ({
    id: "s",
    title: "확인하기",
    done,
    source: "manual",
    edited: false,
  });
  assert.deepEqual(countSteps([step(true), step(false), step(true)]), {
    total: 3,
    doneCount: 2,
    remaining: 1,
  });
});
