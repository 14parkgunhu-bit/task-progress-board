// Design Ref: §3.2 `calcProgress`·`isComplete` — PRD 5장 "진행률"·"완료 판정"
// 진행률과 완료는 항상 앱이 이 함수로 계산한다. AI는 계산하지 않는다.
import { MAX_PROGRESS_WHEN_INCOMPLETE } from "./limits.ts";
import type { Step } from "./types.ts";

/** 개수가 0 이상의 정수이고 완료 수가 전체 수를 넘지 않는지 확인한다. 어긋나면 오류를 낸다. */
function assertCounts(total: number, doneCount: number): void {
  if (
    !Number.isInteger(total) ||
    !Number.isInteger(doneCount) ||
    total < 0 ||
    doneCount < 0 ||
    doneCount > total
  ) {
    throw new Error(`잘못된 할 일 개수입니다: 전체 ${total}, 완료 ${doneCount}`);
  }
}

/**
 * 완료 판정 — 퍼센트가 아니라 개수로 판정한다.
 * 할 일이 1개 이상이고, 미완료가 0개일 때만 완료다. (할 일 0개는 완료가 아니다.)
 */
export function isComplete(total: number, doneCount: number): boolean {
  assertCounts(total, doneCount);
  return total >= 1 && doneCount === total;
}

/**
 * 진행률(%) = 완료 수 ÷ 전체 수 × 100, 반올림한 정수.
 * - 할 일이 0개면 0%
 * - 미완료가 1개라도 남으면 반올림 결과가 100이어도 최대 99% (예: 199개 중 198개 → 99%)
 */
export function calcProgress(total: number, doneCount: number): number {
  assertCounts(total, doneCount);
  if (total === 0) return 0;
  const rounded = Math.round((doneCount / total) * 100);
  return isComplete(total, doneCount)
    ? rounded
    : Math.min(rounded, MAX_PROGRESS_WHEN_INCOMPLETE);
}

/** 할 일 목록에서 전체·완료·남은 개수를 센다. */
export function countSteps(steps: readonly Step[]): {
  total: number;
  doneCount: number;
  remaining: number;
} {
  const total = steps.length;
  const doneCount = steps.filter((step) => step.done).length;
  return { total, doneCount, remaining: total - doneCount };
}
