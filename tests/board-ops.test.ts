// Design Ref: §2.3 ① — 진행판 조작: revision 증가·상한·출처 기록 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addManualSteps,
  addTask,
  createEmptyBoard,
  deleteStep,
  deleteTask,
  toggleStep,
  updateStep,
  updateTask,
} from "../lib/board.ts";
import type { BoardData } from "../lib/types.ts";
import { makeTask } from "./helpers.ts";

const NOW = "2026-10-12T00:00:00.000Z";
const input = { title: "가을 체육행사 준비", dueDate: "2026-10-20", memo: "" };

test("업무 등록은 끝에 추가되고 보드 revision이 오른다", () => {
  const board = addTask(createEmptyBoard(), input, NOW, "t1");
  assert.equal(board.revision, 1);
  assert.equal(board.tasks[0].id, "t1");
  assert.equal(board.tasks[0].revision, 0);
  const next = addTask(board, { ...input, title: "두 번째" }, NOW, "t2");
  assert.deepEqual(next.tasks.map((t) => t.id), ["t1", "t2"]);
});

test("업무 100건이면 더 등록되지 않는다", () => {
  const full: BoardData = {
    schemaVersion: 1,
    revision: 0,
    tasks: Array.from({ length: 100 }, (_, i) => makeTask(`t${i}`, "2026-10-20", 0, 0)),
  };
  assert.equal(addTask(full, input, NOW), full);
});

test("업무 수정·할 일 체크는 업무 revision과 보드 revision을 함께 올린다", () => {
  const board: BoardData = { schemaVersion: 1, revision: 5, tasks: [makeTask("t", "2026-10-20", 0, 2)] };
  const edited = updateTask(board, "t", { ...input, memo: "참가 80명" }, NOW);
  assert.equal(edited.revision, 6);
  assert.equal(edited.tasks[0].revision, 1);
  const toggled = toggleStep(edited, "t", "t-0", NOW);
  assert.equal(toggled.tasks[0].steps[0].done, true);
  assert.equal(toggled.tasks[0].revision, 2);
  assert.equal(toggled.revision, 7);
});

test("없는 업무를 고치면 진행판이 그대로다", () => {
  const board = createEmptyBoard();
  assert.equal(updateTask(board, "없음", input, NOW), board);
  assert.equal(deleteTask(board, "없음"), board);
});

test("직접 입력: 빈 칸은 무시, 출처는 manual, 50개 상한", () => {
  const board: BoardData = { schemaVersion: 1, revision: 0, tasks: [makeTask("t", "2026-10-20", 0, 0)] };
  let n = 0;
  const added = addManualSteps(
    board,
    "t",
    [{ title: " 장소 예약하기 " }, { title: "   " }, { title: "안내문 발송하기", dueDate: "2026-10-15" }],
    NOW,
    () => `s${n++}`,
  );
  assert.deepEqual(
    added.tasks[0].steps.map((s) => [s.title, s.dueDate, s.source, s.edited]),
    [
      ["장소 예약하기", undefined, "manual", false],
      ["안내문 발송하기", "2026-10-15", "manual", false],
    ],
  );
  assert.equal(addManualSteps(board, "t", [{ title: "" }], NOW), board); // 모두 빈 칸
  const nearFull: BoardData = { schemaVersion: 1, revision: 0, tasks: [makeTask("t", "2026-10-20", 0, 49)] };
  assert.equal(addManualSteps(nearFull, "t", [{ title: "하나" }, { title: "둘" }], NOW), nearFull);
});

test("AI 제안 할 일을 고치면 edited = true, 그대로면 false", () => {
  const task = makeTask("t", "2026-10-20", 0, 1);
  task.steps[0] = { ...task.steps[0], source: "ai", title: "장소 예약하기" };
  const board: BoardData = { schemaVersion: 1, revision: 0, tasks: [task] };
  const same = updateStep(board, "t", "t-0", { title: "장소 예약하기" }, NOW);
  assert.equal(same.tasks[0].steps[0].edited, false);
  const changed = updateStep(board, "t", "t-0", { title: "체육관 예약하기" }, NOW);
  assert.equal(changed.tasks[0].steps[0].edited, true);
});

test("할 일 삭제와 업무 삭제", () => {
  const board: BoardData = { schemaVersion: 1, revision: 0, tasks: [makeTask("t", "2026-10-20", 0, 2)] };
  assert.equal(deleteStep(board, "t", "t-0", NOW).tasks[0].steps.length, 1);
  const removed = deleteTask(board, "t");
  assert.equal(removed.tasks.length, 0);
  assert.equal(removed.revision, 1);
});
