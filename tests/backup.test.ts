// 가상 업무 데이터로만 백업 형식·손상·크기·복원 경합을 점검한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { backupCounts, createBackup, prepareRestoredBoard, readBackup } from "../lib/backup.ts";
import { createEmptyBoard } from "../lib/board.ts";
import { MAX_BACKUP_FILE_BYTES } from "../lib/limits.ts";
import { makeTask } from "./helpers.ts";
const exportedAt = "2026-10-12T00:00:00.000Z";
function fixture() {
  const task = makeTask("fixture", "2025-12-31", 1, 2);
  task.memo = "가상 메모";
  task.steps[0] = { ...task.steps[0], source: "ai", edited: true, dueDate: "2025-12-01" };
  return { ...createEmptyBoard(), revision: 3, tasks: [task] };
}
test("백업 왕복은 과거 마감일·체크·출처·메모를 그대로 보존한다", () => {
  const board = fixture();
  const before = JSON.stringify(board);
  const result = readBackup(createBackup(board, exportedAt));
  assert.ok(result.ok);
  if (result.ok) { assert.deepEqual(result.board, board); assert.equal(result.exportedAt, exportedAt); }
  assert.equal(JSON.stringify(board), before);
  assert.equal(readBackup("\uFEFF" + createBackup(board, exportedAt)).ok, true);
});
test("잘못된 JSON·다른 파일·지원하지 않는 버전은 분명한 오류로 거절한다", () => {
  for (const content of ["", "{broken", "[]", "{}", JSON.stringify({ format: "other" })]) assert.equal(readBackup(content).ok, false);
  const wrongVersion = JSON.parse(createBackup(fixture(), exportedAt));
  wrongVersion.board.schemaVersion = 2;
  const result = readBackup(JSON.stringify(wrongVersion));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /버전/);
});
test("손상된 업무·중복 ID·안전하지 않은 버전 번호를 거절한다", () => {
  const mutations = [
    (value: ReturnType<typeof fixture>) => { value.tasks[0].title = "가".repeat(51); },
    (value: ReturnType<typeof fixture>) => { value.tasks[0].dueDate = "2026-02-30"; },
    (value: ReturnType<typeof fixture>) => { value.tasks.push({ ...value.tasks[0] }); },
    (value: ReturnType<typeof fixture>) => { value.tasks[0].steps[1].id = value.tasks[0].steps[0].id; },
    (value: ReturnType<typeof fixture>) => { value.tasks[0].id = ""; },
    (value: ReturnType<typeof fixture>) => { value.revision = 1e100; },
  ];
  for (const mutate of mutations) {
    const raw = JSON.parse(createBackup(fixture(), exportedAt));
    mutate(raw.board);
    assert.equal(readBackup(JSON.stringify(raw)).ok, false);
  }
});
test("큰 파일은 읽기 크기 제한으로 거절한다", () => {
  assert.equal(readBackup(" ".repeat(MAX_BACKUP_FILE_BYTES + 1)).ok, false);
});
test("백업에는 진행판 외의 임의 필드를 넣지 않는다", () => {
  const board = fixture();
  const extra = { ...board, unrelated: "가상 제외 값", tasks: board.tasks.map(task => ({ ...task, unrelated: "가상 제외 값" })) };
  assert.equal(createBackup(extra, exportedAt).includes("가상 제외 값"), false);
});
test("복원은 현재 버전보다 새 버전을 매겨 늦은 AI 응답을 보호한다", () => {
  const current = fixture(); current.revision = 9; current.tasks[0].revision = 7;
  const incoming = fixture();
  const before = JSON.stringify({ current, incoming });
  const restored = prepareRestoredBoard(current, incoming);
  assert.ok(restored);
  assert.equal(restored?.revision, 10);
  assert.equal(restored?.tasks[0].revision, 8);
  assert.equal(restored?.tasks[0].dueDate, incoming.tasks[0].dueDate);
  assert.deepEqual(restored?.tasks[0].steps, incoming.tasks[0].steps);
  assert.equal(JSON.stringify({ current, incoming }), before);
});
test("같은 백업을 반복 복원해도 버전은 이전 결과와 구별된다", () => {
  const incoming = fixture();
  const first = prepareRestoredBoard(fixture(), incoming)!;
  const second = prepareRestoredBoard(first, incoming)!;
  assert.equal(second.revision, first.revision + 1);
  assert.equal(second.tasks[0].revision, first.tasks[0].revision + 1);
});
test("미리보기는 전체 업무·할 일·완료 체크 수와 빈 백업 범위를 계산한다", () => {
  assert.deepEqual(backupCounts(fixture()), { tasks: 1, steps: 2, checked: 1 });
  assert.deepEqual(backupCounts(createEmptyBoard()), { tasks: 0, steps: 0, checked: 0 });
  assert.deepEqual(prepareRestoredBoard(fixture(), createEmptyBoard())?.tasks, []);
});
