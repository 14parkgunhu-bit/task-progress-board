// Design Ref: §7 "입력 길이" — 입력 검사 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countChars,
  validateStepDueDate,
  validateStepTitle,
  validateTaskInput,
} from "../lib/validate-input.ts";

test("글자 수는 화면에 보이는 문자 단위로 센다", () => {
  assert.equal(countChars("업무"), 2);
  assert.equal(countChars("😀a"), 2);
});

test("업무 입력: 업무명 1~50자, 마감일 필수, 메모 1,000자", () => {
  assert.equal(validateTaskInput({ title: "가".repeat(50), dueDate: "2026-10-20", memo: "" }).ok, true);
  assert.ok(validateTaskInput({ title: "가".repeat(51), dueDate: "2026-10-20", memo: "" }).errors.title);
  assert.ok(validateTaskInput({ title: "   ", dueDate: "2026-10-20", memo: "" }).errors.title);
  assert.ok(validateTaskInput({ title: "업무", dueDate: "", memo: "" }).errors.dueDate);
  assert.ok(validateTaskInput({ title: "업무", dueDate: "2026-10-20", memo: "가".repeat(1001) }).errors.memo);
  assert.equal(validateTaskInput({ title: "업무", dueDate: "2026-10-20", memo: "가".repeat(1000) }).ok, true);
});

test("마감일 입력은 2026년부터 허용하고 이전 연도·잘못된 날짜는 거절한다", () => {
  const input = (dueDate: string) => validateTaskInput({ title: "가상 업무", dueDate, memo: "" });
  for (const dueDate of ["2024-12-31", "2025-12-31"]) {
    assert.equal(input(dueDate).ok, false);
    assert.match(input(dueDate).errors.dueDate ?? "", /2026/);
  }
  for (const dueDate of ["2026-01-01", "2026-12-31", "2027-01-01"]) assert.equal(input(dueDate).ok, true);
  assert.equal(input(" 2026-01-01 ").value.dueDate, "2026-01-01");
  assert.equal(input("2026-02-30").ok, false);
});

test("업무 입력은 앞뒤 공백을 지운 값을 돌려준다", () => {
  assert.equal(validateTaskInput({ title: "  업무  ", dueDate: "2026-10-20", memo: " 메모 " }).value.title, "업무");
});

test("할 일 제목 1~30자", () => {
  assert.equal(validateStepTitle("가".repeat(30)), null);
  assert.ok(validateStepTitle("가".repeat(31)));
  assert.ok(validateStepTitle("  "));
});

test("권장 완료일: 선택, 넣으면 오늘~업무 마감일(둘 다 포함)", () => {
  assert.equal(validateStepDueDate(undefined, "2026-10-12", "2026-10-20"), null);
  assert.equal(validateStepDueDate("", "2026-10-12", "2026-10-20"), null);
  assert.equal(validateStepDueDate("2026-10-12", "2026-10-12", "2026-10-20"), null);
  assert.equal(validateStepDueDate("2026-10-20", "2026-10-12", "2026-10-20"), null);
  assert.ok(validateStepDueDate("2026-10-11", "2026-10-12", "2026-10-20"));
  assert.ok(validateStepDueDate("2026-10-21", "2026-10-12", "2026-10-20"));
});
