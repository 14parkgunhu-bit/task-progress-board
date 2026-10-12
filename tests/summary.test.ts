// Design Ref: §8.2 — 기본 요약 형식 점검 (PRD must 2 규칙 1~5)
import assert from "node:assert/strict";
import { test } from "node:test";
import { SUMMARY_MAX_LINE_LENGTH, SUMMARY_MAX_LINES } from "../lib/limits.ts";
import { buildViews } from "../lib/status.ts";
import { buildBasicSummary, normalizeLine, shortenTitle } from "../lib/summary.ts";
import { countChars } from "../lib/validate-input.ts";
import { makeTask } from "./helpers.ts";

const TODAY = "2026-10-12";

test("업무명 줄임: 15자는 그대로, 16자는 14자 + …", () => {
  assert.equal(shortenTitle("가".repeat(15)), "가".repeat(15));
  assert.equal(shortenTitle("가".repeat(16)), `${"가".repeat(14)}…`);
});

test("업무 0건이면 1줄", () => {
  assert.deepEqual(buildBasicSummary([]), ["전체 0건 | 완료 0 · 지연 0 · 임박 0 · 정상 0"]);
});

test("미완료 2건이면 3줄(그 외 없음), 줄 형식과 ⚠ 표시", () => {
  const views = buildViews(
    [makeTask("가을 체육행사 준비", "2026-10-14", 2, 5), makeTask("강사 워크숍 운영", "2026-11-30", 0, 3)],
    TODAY,
  );
  assert.deepEqual(buildBasicSummary(views), [
    "전체 2건 | 완료 0 · 지연 0 · 임박 1 · 정상 1",
    "⚠ [임박] 가을 체육행사 준비 – 진행률 40% – 남은 할 일 3개 – 마감 10/14",
    "[정상] 강사 워크숍 운영 – 진행률 0% – 남은 할 일 3개 – 마감 11/30",
  ]);
});

test("지연 5건이면 5줄, 마지막 줄은 나머지 2건을 상태별로 묶는다", () => {
  const views = buildViews(
    Array.from({ length: 5 }, (_, i) => makeTask(`지연 업무 ${i + 1}`, `2026-10-0${i + 1}`, 0, 1)),
    TODAY,
  );
  const lines = buildBasicSummary(views);
  assert.equal(lines.length, 5);
  assert.equal(lines[1].startsWith("⚠ [지연] 지연 업무 1"), true);
  assert.equal(lines[4], "그 외 2건 (완료 0 · 지연 2 · 임박 0 · 정상 0)");
});

test("완료 업무는 업무 줄로 쓰지 않고 그 외에 묶는다", () => {
  const views = buildViews(
    [makeTask("끝난 업무", "2026-10-01", 2, 2), makeTask("진행 업무", "2026-11-01", 1, 2)],
    TODAY,
  );
  assert.deepEqual(buildBasicSummary(views).slice(1), [
    "[정상] 진행 업무 – 진행률 50% – 남은 할 일 1개 – 마감 11/01",
    "그 외 1건 (완료 1 · 지연 0 · 임박 0 · 정상 0)",
  ]);
});

test("가장 긴 경우에도 5줄·한 줄 60자를 넘지 않는다 (업무명 50자, 업무 100건)", () => {
  const longTitle = "가".repeat(50);
  const tasks = Array.from({ length: 100 }, (_, i) => makeTask(`${longTitle}${i}`, "2026-10-12", 49, 50));
  const lines = buildBasicSummary(buildViews(tasks, TODAY));
  assert.ok(lines.length <= SUMMARY_MAX_LINES);
  for (const line of lines) assert.ok(countChars(line) <= SUMMARY_MAX_LINE_LENGTH, `${countChars(line)}자: ${line}`);
});

test("줄 정리: 앞뒤 공백 제거, 하이픈을 긴 줄표로", () => {
  assert.equal(normalizeLine("  [정상] 업무 - 진행률 0% — 끝 "), "[정상] 업무 – 진행률 0% – 끝");
});
