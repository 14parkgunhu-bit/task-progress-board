// Design Ref: §3.2 `calcStatus`·`sortViews` — PRD 5장 "업무 상태"·"정렬"
// 상태 판정 순서: 완료 → 지연 → 임박 → 정상 (먼저 해당하는 것 하나)
import { calcDDay } from "./dates.ts";
import { DUE_SOON_DAYS } from "./limits.ts";
import { calcProgress, countSteps, isComplete } from "./progress.ts";
import type { DateString, Task, TaskStatus, TaskView } from "./types.ts";

/** 화면·요약에 쓰는 상태 이름 */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  done: "완료",
  overdue: "지연",
  dueSoon: "임박",
  normal: "정상",
};

/** 정렬 순서: 지연 → 임박 → 정상 → 완료 */
export const STATUS_ORDER: Record<TaskStatus, number> = {
  overdue: 0,
  dueSoon: 1,
  normal: 2,
  done: 3,
};

/**
 * 상태 판정.
 * - 완료: 할 일 1개 이상, 미완료 0개 (마감이 지났어도 완료가 우선)
 * - 지연: 완료가 아니고 마감일이 오늘보다 이전 (D+1 이상)
 * - 임박: 완료가 아니고 마감일이 오늘~3일 뒤 (D-3 ~ D-day)
 * - 정상: 그 밖
 */
export function calcStatus(
  total: number,
  doneCount: number,
  dueDate: DateString,
  today: DateString,
): TaskStatus {
  if (isComplete(total, doneCount)) return "done";
  const dDay = calcDDay(dueDate, today);
  if (dDay < 0) return "overdue";
  if (dDay <= DUE_SOON_DAYS) return "dueSoon";
  return "normal";
}

/** 업무 하나의 계산 결과를 만든다. */
export function toTaskView(task: Task, today: DateString): TaskView {
  const { total, doneCount, remaining } = countSteps(task.steps);
  return {
    task,
    total,
    doneCount,
    remaining,
    progress: calcProgress(total, doneCount),
    status: calcStatus(total, doneCount, task.dueDate, today),
    dDay: calcDDay(task.dueDate, today),
  };
}

/**
 * 정렬: 지연 → 임박 → 정상 → 완료, 같은 상태는 마감일 빠른 순,
 * 마감일도 같으면 원래 순서(= 등록 순)를 유지한다. 원본 배열은 바꾸지 않는다.
 */
export function sortViews(views: readonly TaskView[]): TaskView[] {
  return views
    .map((view, index) => ({ view, index }))
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.view.status] - STATUS_ORDER[b.view.status];
      if (byStatus !== 0) return byStatus;
      if (a.view.task.dueDate !== b.view.task.dueDate) {
        // "YYYY-MM-DD"는 글자 순서가 곧 날짜 순서다
        return a.view.task.dueDate < b.view.task.dueDate ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ view }) => view);
}

/** 등록 순서대로 들어온 업무 목록을 계산·정렬해 돌려준다. */
export function buildViews(tasks: readonly Task[], today: DateString): TaskView[] {
  return sortViews(tasks.map((task) => toTaskView(task, today)));
}

/** 상태별 건수 */
export function countByStatus(views: readonly TaskView[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { done: 0, overdue: 0, dueSoon: 0, normal: 0 };
  for (const view of views) counts[view.status] += 1;
  return counts;
}
