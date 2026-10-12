// Design Ref: §3.2 `buildBasicSummary`·`shortenTitle`·`normalizeLine` — PRD must 2 요약 규칙 1~5
// AI 없이 앱이 계산한 값만으로 만드는 "기본 요약". AI 요약 사실 검사의 정답이자, AI 실패 시 대체 요약이다.
import { calcDDay, formatMonthDay } from "./dates.ts";
import { SUMMARY_MAX_TASK_LINES, SUMMARY_TITLE_MAX_LENGTH } from "./limits.ts";
import { calcProgress } from "./progress.ts";
import { calcStatus, countByStatus, sortViews, STATUS_LABEL } from "./status.ts";
import type { TaskStatus, TaskView } from "./types.ts";

/** 업무명을 15자까지만 쓴다. 넘으면 앞 14자 + "…" (문자 단위로 셈) */
export function shortenTitle(title: string): string {
  const chars = [...title];
  if (chars.length <= SUMMARY_TITLE_MAX_LENGTH) return title;
  return `${chars.slice(0, SUMMARY_TITLE_MAX_LENGTH - 1).join("")}…`;
}

function formatCounts(counts: Record<TaskStatus, number>): string {
  return `완료 ${counts.done} · 지연 ${counts.overdue} · 임박 ${counts.dueSoon} · 정상 ${counts.normal}`;
}

/**
 * 기본 요약 (최대 5줄)
 * 1줄: `전체 ○건 | 완료 ○ · 지연 ○ · 임박 ○ · 정상 ○`
 * 다음: 미완료 업무를 정렬 순서대로 최대 3건 `⚠ [임박] 업무명 – 진행률 40% – 남은 할 일 3개 – 마감 10/08`
 * 마지막: 업무 줄로 쓰지 못한 나머지 `그 외 ○건 (완료 ○ · 지연 ○ · 임박 ○ · 정상 ○)` — 없으면 생략
 * views는 등록 순서든 정렬된 순서든 상관없다(안에서 다시 정렬한다).
 * AI에 넘기는 계산값(summaryFacts)과 같은 재료로 만들어, 사실 검사의 정답이 된다.
 */
export function buildBasicSummary(views: readonly TaskView[]): string[] {
  const facts = summaryFacts(views);
  const lines = [`전체 ${facts.total}건 | ${formatCounts(facts.counts)}`];
  for (const line of facts.taskLines) {
    lines.push(
      `${line.warning ? "⚠ " : ""}[${line.status}] ${line.title}` +
        ` – 진행률 ${line.progress}% – 남은 할 일 ${line.remaining}개 – 마감 ${line.due}`,
    );
  }
  if (facts.rest) lines.push(`그 외 ${facts.rest.total}건 (${formatCounts(facts.rest.counts)})`);
  return lines;
}

/** 사실 검사 비교용 줄 정리: 앞뒤 공백 제거, 하이픈 "-"·"—"를 긴 줄표 "–"로 */
export function normalizeLine(line: string): string {
  return line.trim().replace(/[-—]/g, "–");
}

/** 요약 API가 받는 업무 한 건 (메모·할 일 제목은 받지 않는다 — DESIGN 7장 전송 최소화) */
export type SummaryTaskInput = { title: string; dueDate: string; total: number; done: number };

/**
 * 할 일 개수만으로 업무 계산 결과를 만든다. (서버가 브라우저가 보낸 숫자를 믿지 않고 직접 다시 계산)
 * 입력 순서 = 등록 순서로 보고, 같은 마감일 정렬 기준으로 쓴다.
 */
export function viewsFromCounts(items: readonly SummaryTaskInput[], today: string): TaskView[] {
  return items.map((item, index) => {
    const total = item.total;
    const doneCount = item.done;
    return {
      task: {
        id: String(index),
        title: item.title,
        dueDate: item.dueDate,
        memo: "",
        steps: [],
        revision: 0,
        createdAt: "",
        updatedAt: "",
      },
      total,
      doneCount,
      remaining: total - doneCount,
      progress: calcProgress(total, doneCount),
      status: calcStatus(total, doneCount, item.dueDate, today),
      dDay: calcDDay(item.dueDate, today),
    };
  });
}

/** AI 프롬프트에 넘길 계산값 (기본 요약과 같은 재료) */
export function summaryFacts(views: readonly TaskView[]) {
  const sorted = sortViews(views);
  const shown = sorted.filter((view) => view.status !== "done").slice(0, SUMMARY_MAX_TASK_LINES);
  const rest = sorted.filter((view) => !shown.includes(view));
  return {
    total: sorted.length,
    counts: countByStatus(sorted),
    taskLines: shown.map((view) => ({
      status: STATUS_LABEL[view.status],
      warning: view.status === "overdue" || view.status === "dueSoon",
      title: shortenTitle(view.task.title),
      progress: view.progress,
      remaining: view.remaining,
      due: formatMonthDay(view.task.dueDate),
    })),
    rest: rest.length > 0 ? { total: rest.length, counts: countByStatus(rest) } : null,
  };
}
