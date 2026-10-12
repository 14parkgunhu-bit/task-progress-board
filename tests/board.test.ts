// Design Ref: §3.1 — 저장 데이터 검사 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptyBoard, parseBoardData } from "../lib/board.ts";
import { makeTask } from "./helpers.ts";

test("빈 진행판은 형식 버전 1, 버전 번호 0, 업무 0건", () => {
  assert.deepEqual(createEmptyBoard(), { schemaVersion: 1, revision: 0, tasks: [] });
});

test("올바른 저장 데이터는 그대로 불러온다", () => {
  const board = { schemaVersion: 1, revision: 3, tasks: [makeTask("가을 체육행사 준비", "2026-10-20", 1, 3)] };
  assert.deepEqual(parseBoardData(JSON.parse(JSON.stringify(board))), board);
});

test("형태가 어긋난 저장 데이터는 거절한다", () => {
  const good = makeTask("t", "2026-10-20", 0, 1);
  assert.equal(parseBoardData(null), null);
  assert.equal(parseBoardData("문자열"), null);
  assert.equal(parseBoardData({ schemaVersion: 2, revision: 0, tasks: [] }), null);
  assert.equal(parseBoardData({ schemaVersion: 1, revision: -1, tasks: [] }), null);
  assert.equal(parseBoardData({ schemaVersion: 1, revision: 0, tasks: [{ ...good, dueDate: "2026-02-30" }] }), null);
  assert.equal(
    parseBoardData({ schemaVersion: 1, revision: 0, tasks: [{ ...good, steps: [{ ...good.steps[0], source: "robot" }] }] }),
    null,
  );
});

test("상한을 넘는 저장 데이터는 거절한다 (업무 101건, 할 일 51개)", () => {
  const many = Array.from({ length: 101 }, (_, i) => makeTask(`t${i}`, "2026-10-20", 0, 0));
  assert.equal(parseBoardData({ schemaVersion: 1, revision: 0, tasks: many }), null);
  const bigTask = makeTask("big", "2026-10-20", 0, 51);
  assert.equal(parseBoardData({ schemaVersion: 1, revision: 0, tasks: [bigTask] }), null);
});

test("글자 수 상한을 넘는 저장 데이터는 거절한다 (업무명 51자·메모 1,001자·할 일 제목 31자)", () => {
  const good = makeTask("t", "2026-10-20", 0, 1);
  const wrap = (task: typeof good) => ({ schemaVersion: 1, revision: 0, tasks: [task] });
  assert.notEqual(parseBoardData(wrap({ ...good, title: "가".repeat(50), memo: "가".repeat(1000) })), null);
  assert.equal(parseBoardData(wrap({ ...good, title: "가".repeat(51) })), null);
  assert.equal(parseBoardData(wrap({ ...good, title: "" })), null);
  assert.equal(parseBoardData(wrap({ ...good, memo: "가".repeat(1001) })), null);
  assert.equal(parseBoardData(wrap({ ...good, steps: [{ ...good.steps[0], title: "가".repeat(31) }] })), null);
});
