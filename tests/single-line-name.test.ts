// 갭 G1·G3 — 줄바꿈 업무명으로 요약 줄 수가 늘어나는 문제, 복합 이모지 글자 수
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBoardData } from "../lib/board.ts";
import { buildViews } from "../lib/status.ts";
import { shortenTitle } from "../lib/summary.ts";
import { parseStepsResponse } from "../lib/validate-steps.ts";
import {
  countChars,
  hasLineBreakOrControl,
  isSingleLineName,
  validateStepTitle,
  validateTaskInput,
} from "../lib/validate-input.ts";
import { makeTask } from "./helpers.ts";

const FAMILY = "👨‍👩‍👧"; // 코드 5개로 된 글자 1개

test("화면에 보이는 글자 단위로 센다 (가족 이모지 1자)", () => {
  assert.equal(countChars(FAMILY), 1);
  assert.equal(countChars(`가${FAMILY}나`), 3);
  assert.equal(countChars("업무"), 2);
});

test("줄바꿈·탭·제어 문자를 찾는다", () => {
  for (const bad of ["첫줄\n둘째줄", "a\rb", "a\tb", "a\u2028b", "a\u0000b"]) assert.equal(hasLineBreakOrControl(bad), true, JSON.stringify(bad));
  assert.equal(hasLineBreakOrControl("가을 체육행사 준비 (2차)"), false);
});

test("한 줄짜리 이름: 공백만·줄바꿈·글자 수 초과는 거절", () => {
  assert.equal(isSingleLineName("가을 체육행사 준비", 50), true);
  assert.equal(isSingleLineName("   ", 50), false);
  assert.equal(isSingleLineName("첫줄\n둘째줄", 50), false);
  assert.equal(isSingleLineName("가".repeat(51), 50), false);
  assert.equal(isSingleLineName(FAMILY.repeat(50), 50), true); // 이모지 50자는 통과
  assert.equal(isSingleLineName(42, 50), false);
});

test("화면 입력 검사도 줄바꿈 이름을 막는다", () => {
  assert.match(validateTaskInput({ title: "첫줄\n둘째줄", dueDate: "2026-10-30", memo: "" }).errors.title ?? "", /줄바꿈/);
  assert.equal(validateTaskInput({ title: "가상 업무", dueDate: "2026-10-30", memo: "메모 첫줄\n둘째줄" }).ok, true); // 메모는 여러 줄 허용
  assert.match(validateStepTitle("확인\n하기") ?? "", /줄바꿈/);
});

test("저장·복원 데이터: 줄바꿈·공백만 있는 업무명과 할 일 제목은 거절", () => {
  const good = makeTask("t", "2026-10-20", 0, 1);
  const wrap = (task: typeof good) => ({ schemaVersion: 1, revision: 0, tasks: [task] });
  assert.notEqual(parseBoardData(wrap(good)), null);
  assert.equal(parseBoardData(wrap({ ...good, title: "첫줄\n둘째줄\n셋째줄" })), null);
  assert.equal(parseBoardData(wrap({ ...good, title: "   " })), null);
  assert.equal(parseBoardData(wrap({ ...good, steps: [{ ...good.steps[0], title: "확인\n하기" }] })), null);
  assert.notEqual(parseBoardData(wrap({ ...good, memo: "메모 첫줄\n둘째줄" })), null);
});

test("AI 단계 제안에 줄바꿈 제목이 있으면 실패", () => {
  const steps = [
    { title: "장소\n예약하기", dueDate: "2026-10-15" },
    { title: "안내문 발송하기", dueDate: "2026-10-16" },
    { title: "결과 보고하기", dueDate: "2026-10-17" },
  ];
  assert.equal(parseStepsResponse(JSON.stringify({ status: "ok", steps }), "2026-10-12", "2026-10-20"), null);
});

test("요약 업무명 줄이기는 이모지를 반으로 자르지 않는다", () => {
  const title = `${FAMILY.repeat(14)}가나`; // 16자
  const short = shortenTitle(title);
  assert.equal(short, `${FAMILY.repeat(14)}…`);
  assert.equal(countChars(short), 15);
  const views = buildViews([makeTask("e", "2026-10-20", 0, 1, title)], "2026-10-12");
  assert.equal(views.length, 1);
});

test("이 브라우저에 예전에 저장된 탭 섞인 이름은 공백으로 바꿔 불러온다 (진행판 전체가 비지 않게)", async () => {
  const { normalizeLegacyNames } = await import("../lib/board.ts");
  const old = makeTask("t", "2026-10-20", 1, 2, "예산\t점검");
  old.steps[1] = { ...old.steps[1], title: "자료\t확인하기" };
  const stored = { schemaVersion: 1, revision: 2, tasks: [old, makeTask("u", "2026-10-21", 0, 1)] };
  assert.equal(parseBoardData(stored), null); // 정리하지 않으면 전체가 거절된다
  const loaded = parseBoardData(normalizeLegacyNames(JSON.parse(JSON.stringify(stored))));
  assert.ok(loaded);
  assert.equal(loaded?.tasks.length, 2);
  assert.equal(loaded?.tasks[0].title, "예산 점검");
  assert.equal(loaded?.tasks[0].steps[1].title, "자료 확인하기");
  assert.equal(loaded?.tasks[0].steps[0].done, true); // 체크 상태 등 다른 값은 그대로
  assert.equal(normalizeLegacyNames(null), null);
});

test("백업 복원은 정리하지 않고 탭 섞인 이름을 거절한다", async () => {
  const { readBackup } = await import("../lib/backup.ts");
  const board = { schemaVersion: 1, revision: 1, tasks: [makeTask("t", "2026-10-20", 0, 1, "예산\t점검")] };
  const result = readBackup(JSON.stringify({ format: "task-board-backup", exportedAt: "2026-10-12T00:00:00.000Z", board }));
  assert.equal(result.ok, false);
});
