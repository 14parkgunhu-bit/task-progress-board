// 가상 브라우저 저장소로만 실제 저장 결과·실패·반복 등록을 점검한다.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { addTask, createEmptyBoard } from "../lib/board.ts";
import { getBoardSnapshot, restoreBoard, subscribeBoard, updateBoard } from "../lib/client/board-store.ts";
const values = new Map<string, string>();
let blocked = false;
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (blocked && key === "task-board:v1") throw new Error("가상 용량 초과"); values.set(key, value); },
  removeItem: (key: string) => values.delete(key),
} } });
after(() => { if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window"); });
const add = (id: string) => updateBoard(board => addTask(board, { title: "가상 업무", dueDate: "2026-10-20", memo: "" }, "2026-10-12T00:00:00Z", id));
test("반복 등록은 브라우저 저장 성공을 반환하고 실제 저장 데이터와 일치한다", () => {
  assert.equal(add("fixture-1"), "saved");
  assert.equal(add("fixture-2"), "saved");
  assert.equal(getBoardSnapshot().board.tasks.length, 2);
  assert.equal(getBoardSnapshot().saveFailed, false);
  assert.deepEqual(JSON.parse(values.get("task-board:v1")!), getBoardSnapshot().board);
});
test("저장 실패는 화면 상태를 보존하고 성공으로 알리지 않으며 재등록 때 복구할 수 있다", () => {
  const saved = values.get("task-board:v1");
  blocked = true;
  assert.equal(add("fixture-3"), "memory");
  assert.equal(add("fixture-4"), "memory");
  assert.equal(getBoardSnapshot().board.tasks.length, 4);
  assert.equal(getBoardSnapshot().saveFailed, true);
  assert.equal(values.get("task-board:v1"), saved);
  blocked = false;
  assert.equal(add("fixture-5"), "saved");
  assert.equal(getBoardSnapshot().saveFailed, false);
  assert.equal(JSON.parse(values.get("task-board:v1")!).tasks.length, 5);
});
test("변경이 없으면 저장 성공으로 알리거나 구독자에게 불필요한 변경을 보내지 않는다", () => {
  const snapshot = getBoardSnapshot();
  let notifications = 0;
  const unsubscribe = subscribeBoard(() => notifications++);
  assert.equal(updateBoard(board => board), "unchanged");
  assert.equal(getBoardSnapshot(), snapshot);
  assert.equal(notifications, 0);
  unsubscribe();
});

test("확인한 버전의 백업만 복원하고 같은 백업 반복 복원도 새 버전을 가진다", () => {
  const current = getBoardSnapshot().board;
  const incoming = { ...createEmptyBoard(), tasks: [{ ...current.tasks[0], dueDate: "2025-12-31" }] };
  assert.equal(restoreBoard(incoming, current.revision), "saved");
  const first = getBoardSnapshot().board;
  assert.equal(first.tasks.length, 1);
  assert.equal(first.tasks[0].dueDate, "2025-12-31");
  assert.ok(first.revision > current.revision);
  assert.ok(first.tasks[0].revision > current.tasks[0].revision);
  assert.equal(restoreBoard(incoming, first.revision), "saved");
  assert.ok(getBoardSnapshot().board.revision > first.revision);
  assert.deepEqual(JSON.parse(values.get("task-board:v1")!), getBoardSnapshot().board);
});
test("복원 저장 실패는 기존 화면과 저장 값을 바꾸지 않고 재시도할 수 있다", () => {
  const before = getBoardSnapshot();
  const stored = values.get("task-board:v1");
  blocked = true;
  assert.equal(restoreBoard(createEmptyBoard(), before.board.revision), "failed");
  assert.equal(getBoardSnapshot(), before);
  assert.equal(values.get("task-board:v1"), stored);
  blocked = false;
  assert.equal(restoreBoard(before.board, before.board.revision), "saved");
});
test("미리보기 뒤 진행판이 바뀌면 덮어쓰지 않는다", () => {
  const previewRevision = getBoardSnapshot().board.revision;
  add("가상 동시 변경");
  const before = getBoardSnapshot();
  const stored = values.get("task-board:v1");
  assert.equal(restoreBoard(createEmptyBoard(), previewRevision), "changed");
  assert.equal(getBoardSnapshot(), before);
  assert.equal(values.get("task-board:v1"), stored);
});
test("손상된 백업을 직접 전달해도 기존 진행판을 바꾸지 않는다", () => {
  const before = getBoardSnapshot();
  const invalid = { ...createEmptyBoard(), revision: 1e100 };
  assert.equal(restoreBoard(invalid, before.board.revision), "failed");
  assert.equal(getBoardSnapshot(), before);
});
