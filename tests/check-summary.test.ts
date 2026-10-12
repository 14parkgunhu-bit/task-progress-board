// Design Ref: §8.2 — AI 요약 형식·사실 검사 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSummary } from "../lib/check-summary.ts";
import { buildBasicSummary, summaryFacts, viewsFromCounts } from "../lib/summary.ts";

const TODAY = "2026-10-12";
const views = viewsFromCounts(
  [
    { title: "가을 체육행사 준비", dueDate: "2026-10-14", total: 5, done: 2 },
    { title: "강사 워크숍 운영", dueDate: "2026-11-30", total: 3, done: 0 },
  ],
  TODAY,
);
const expected = buildBasicSummary(views);
const asJson = (lines: string[]) => JSON.stringify({ lines });

test("정답과 같으면 통과", () => {
  assert.deepEqual(checkSummary(asJson(expected), expected), expected);
});

test("하이픈·앞뒤 공백 차이만 있으면 통과 (줄바꿈 문장도 허용)", () => {
  const loose = expected.map((line) => ` ${line.replaceAll("–", "-")} `).join("\n");
  assert.deepEqual(checkSummary(loose, expected), expected);
});

test("진행률 1% 다름·없는 업무명·순서 바뀜은 실패", () => {
  assert.equal(checkSummary(asJson([expected[0], expected[1].replace("40%", "41%"), expected[2]]), expected), null);
  assert.equal(checkSummary(asJson([expected[0], expected[1].replace("가을 체육행사", "봄 체육행사"), expected[2]]), expected), null);
  assert.equal(checkSummary(asJson([expected[0], expected[2], expected[1]]), expected), null);
});

test("6줄·60자 초과·빈 응답은 실패", () => {
  assert.equal(checkSummary(asJson([...expected, "a", "b", "c"]), expected), null);
  assert.equal(checkSummary(asJson([expected[0], `${expected[1]}${"가".repeat(20)}`, expected[2]]), expected), null);
  assert.equal(checkSummary(asJson([]), expected), null);
  assert.equal(checkSummary("{}", expected), null);
});

test("서버 계산값: 브라우저가 보낸 개수로 진행률·상태를 다시 계산한다", () => {
  const facts = summaryFacts(views);
  assert.equal(facts.total, 2);
  assert.deepEqual(facts.counts, { done: 0, overdue: 0, dueSoon: 1, normal: 1 });
  assert.deepEqual(facts.taskLines[0], {
    status: "임박",
    warning: true,
    title: "가을 체육행사 준비",
    progress: 40,
    remaining: 3,
    due: "10/14",
  });
  assert.equal(facts.rest, null);
});

test("viewsFromCounts는 미완료가 남으면 99%까지만", () => {
  const [view] = viewsFromCounts([{ title: "큰 업무", dueDate: "2026-12-01", total: 50, done: 49 }], TODAY);
  assert.equal(view.progress, 98);
  assert.equal(view.status, "normal");
});

test("통과하면 정답 원문을 돌려준다 (업무명 안의 하이픈이 화면에서 바뀌지 않는다)", () => {
  const dashViews = viewsFromCounts([{ title: "A-B 사업 점검", dueDate: "2026-10-20", total: 2, done: 1 }], TODAY);
  const answer = buildBasicSummary(dashViews);
  assert.ok(answer[1].includes("A-B 사업 점검"));
  assert.deepEqual(checkSummary(asJson(answer), answer), answer);
});
