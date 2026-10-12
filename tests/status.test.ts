// Design Ref: §8.2 — 상태 판정·정렬 경계 사례 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildViews, calcStatus, countByStatus, toTaskView } from "../lib/status.ts";
import { makeTask } from "./helpers.ts";

const TODAY = "2026-10-12";

test("상태 경계: D-4 정상 · D-3 임박 · D-day 임박 · D+1 지연", () => {
  assert.equal(calcStatus(2, 0, "2026-10-16", TODAY), "normal");
  assert.equal(calcStatus(2, 0, "2026-10-15", TODAY), "dueSoon");
  assert.equal(calcStatus(2, 1, "2026-10-12", TODAY), "dueSoon");
  assert.equal(calcStatus(2, 1, "2026-10-11", TODAY), "overdue");
});

test("마감이 지났어도 전부 완료면 완료", () => {
  assert.equal(calcStatus(2, 2, "2026-10-01", TODAY), "done");
});

test("할 일 0개는 완료가 아니다", () => {
  assert.equal(calcStatus(0, 0, "2026-10-01", TODAY), "overdue");
  assert.equal(calcStatus(0, 0, "2026-12-01", TODAY), "normal");
});

test("199개 중 198개 완료는 99%이고 완료가 아니다", () => {
  const view = toTaskView(makeTask("큰 업무", "2026-12-01", 198, 199), TODAY);
  assert.equal(view.progress, 99);
  assert.equal(view.status, "normal");
});

test("정렬: 지연 → 임박 → 정상 → 완료, 같은 상태는 마감 빠른 순, 같은 마감은 등록 순", () => {
  const tasks = [
    makeTask("A정상늦음", "2026-12-01", 0, 2),
    makeTask("B완료", "2026-10-01", 2, 2),
    makeTask("C임박", "2026-10-14", 0, 1),
    makeTask("D지연", "2026-10-10", 1, 2),
    makeTask("E임박같은날", "2026-10-14", 0, 1),
    makeTask("F정상빠름", "2026-10-20", 0, 1),
  ];
  const order = buildViews(tasks, TODAY).map((view) => view.task.id);
  assert.deepEqual(order, ["D지연", "C임박", "E임박같은날", "F정상빠름", "A정상늦음", "B완료"]);
  assert.deepEqual(countByStatus(buildViews(tasks, TODAY)), {
    done: 1,
    overdue: 1,
    dueSoon: 2,
    normal: 2,
  });
});

test("업무 계산 결과에 진행률·남은 할 일·D-day가 들어간다", () => {
  const view = toTaskView(makeTask("V", "2026-10-13", 1, 3), TODAY);
  assert.equal(view.progress, 33);
  assert.equal(view.remaining, 2);
  assert.equal(view.dDay, 1);
  assert.equal(view.status, "dueSoon");
});
