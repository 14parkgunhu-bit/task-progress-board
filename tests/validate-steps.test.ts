// Design Ref: §8.2 — AI 단계 응답 검증 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStepsResponse } from "../lib/validate-steps.ts";

const TODAY = "2026-10-12";
const DUE = "2026-10-20";
const step = (title: string, dueDate = "2026-10-15") => ({ title, dueDate });
const ok = (steps: unknown[]) => JSON.stringify({ status: "ok", steps });
const three = [step("장소 예약하기"), step("안내문 발송하기"), step("결과 보고하기")];

test("규칙에 맞는 3개 제안은 통과한다", () => {
  const result = parseStepsResponse(ok(three), TODAY, DUE);
  assert.equal(result?.status, "ok");
  assert.equal(result?.status === "ok" && result.steps.length, 3);
});

test("개수가 2개·8개면 실패", () => {
  assert.equal(parseStepsResponse(ok(three.slice(0, 2)), TODAY, DUE), null);
  const eight = Array.from({ length: 8 }, (_, i) => step(`${i + 1}단계 처리하기`));
  assert.equal(parseStepsResponse(ok(eight), TODAY, DUE), null);
});

test("31자·하기로 안 끝남·중복이면 실패", () => {
  assert.equal(parseStepsResponse(ok([step(`${"가".repeat(29)}하기`), ...three.slice(1)]), TODAY, DUE), null);
  assert.equal(parseStepsResponse(ok([step("장소 예약"), ...three.slice(1)]), TODAY, DUE), null);
  assert.equal(parseStepsResponse(ok([step("장소 예약하기"), step("장소 예약하기"), step("결과 보고하기")]), TODAY, DUE), null);
});

test("권장 완료일: 오늘·마감일 당일은 통과, 범위 밖·누락은 실패", () => {
  assert.notEqual(parseStepsResponse(ok([step("가 하기", TODAY), step("나 하기", DUE), step("다 하기")]), TODAY, DUE), null);
  assert.equal(parseStepsResponse(ok([step("가 하기", "2026-10-11"), step("나 하기"), step("다 하기")]), TODAY, DUE), null);
  assert.equal(parseStepsResponse(ok([step("가 하기", "2026-10-21"), step("나 하기"), step("다 하기")]), TODAY, DUE), null);
  assert.equal(parseStepsResponse(ok([{ title: "가 하기" }, step("나 하기"), step("다 하기")]), TODAY, DUE), null);
});

test("추가 입력 요청은 질문이 있어야 통과", () => {
  assert.deepEqual(
    parseStepsResponse(JSON.stringify({ status: "need_more_info", question: " 어떤 행사인가요? " }), TODAY, DUE),
    { status: "need_more_info", question: "어떤 행사인가요?" },
  );
  assert.equal(parseStepsResponse(JSON.stringify({ status: "need_more_info", question: "" }), TODAY, DUE), null);
});

test("JSON이 아니거나 status가 다르면 실패", () => {
  assert.equal(parseStepsResponse("할 일: 장소 예약하기", TODAY, DUE), null);
  assert.equal(parseStepsResponse(JSON.stringify({ status: "done", steps: three }), TODAY, DUE), null);
});
