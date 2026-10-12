// 기존 날짜·상태 계산 기준을 쓰는 목록 필터 경계·반복 동작 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildViews, filterViews } from "../lib/status.ts";
import { makeTask } from "./helpers.ts";
const tasks = [makeTask("정상", "2026-10-20", 0, 1), makeTask("임박", "2026-10-14", 0, 1), makeTask("과거 지연", "2025-12-31", 0, 1), makeTask("완료", "2026-10-11", 1, 1)];
test("전체·임박·지연 필터는 원래 순서와 과거 저장 업무를 유지한다", () => {
  const views = buildViews(tasks, "2026-10-12");
  assert.equal(filterViews(views, "all"), views);
  assert.deepEqual(filterViews(views, "dueSoon").map(view => view.task.id), ["임박"]);
  assert.deepEqual(filterViews(views, "overdue").map(view => view.task.id), ["과거 지연"]);
});
test("날짜 경계와 완료 체크 뒤에는 기존 상태 계산 결과에 따라 필터가 바뀐다", () => {
  const task = makeTask("경계", "2026-10-15", 0, 1);
  assert.equal(filterViews(buildViews([task], "2026-10-11"), "dueSoon").length, 0);
  assert.equal(filterViews(buildViews([task], "2026-10-12"), "dueSoon").length, 1);
  assert.equal(filterViews(buildViews([task], "2026-10-16"), "overdue").length, 1);
  assert.equal(filterViews(buildViews([{ ...task, steps: task.steps.map(step => ({ ...step, done: true })) }], "2026-10-16"), "overdue").length, 0);
});
test("필터를 반복 전환해도 원본 업무와 전체 요약 대상은 바뀌지 않는다", () => {
  const views = buildViews(tasks, "2026-10-12");
  const before = JSON.stringify(views);
  for (let repeat = 0; repeat < 3; repeat++) {
    filterViews(views, "dueSoon"); filterViews(views, "overdue");
    assert.equal(filterViews(views, "all").length, tasks.length);
  }
  assert.equal(JSON.stringify(views), before);
});
test("빈 목록이나 일치하지 않는 상태는 빈 필터 결과를 반환한다", () => {
  assert.deepEqual(filterViews([], "overdue"), []);
  assert.deepEqual(filterViews(buildViews([tasks[0]], "2026-10-12"), "dueSoon"), []);
});
