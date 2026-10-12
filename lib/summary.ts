// Design Ref: §3.2 `buildBasicSummary`·`shortenTitle`·`normalizeLine` — PRD must 2 요약 규칙 1~5
// AI 없이 앱이 계산한 값만으로 만드는 "기본 요약". AI 요약 사실 검사의 정답이자, AI 실패 시 대체 요약이다.
import { formatMonthDay } from "./dates.ts";
import { SUMMARY_MAX_TASK_LINES, SUMMARY_TITLE_MAX_LENGTH } from "./limits.ts";
import { countByStatus, sortViews, STATUS_LABEL } from "./status.ts";
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

/** 업무 줄: `⚠ [임박] 업무명 – 진행률 40% – 남은 할 일 3개 – 마감 10/08` */
function formatTaskLine(view: TaskView): string {
  const warning = view.status === "overdue" || view.status === "dueSoon" ? "⚠ " : "";
  return (
    `${warning}[${STATUS_LABEL[view.status]}] ${shortenTitle(view.task.title)}` +
    ` – 진행률 ${view.progress}% – 남은 할 일 ${view.remaining}개` +
    ` – 마감 ${formatMonthDay(view.task.dueDate)}`
  );
}

/**
 * 기본 요약 (최대 5줄)
 * 1줄: `전체 ○건 | 완료 ○ · 지연 ○ · 임박 ○ · 정상 ○`
 * 다음: 미완료 업무를 정렬 순서대로 최대 3건
 * 마지막: 업무 줄로 쓰지 못한 나머지 `그 외 ○건 (완료 ○ · 지연 ○ · 임박 ○ · 정상 ○)` — 없으면 생략
 * views는 등록 순서든 정렬된 순서든 상관없다(안에서 다시 정렬한다).
 */
export function buildBasicSummary(views: readonly TaskView[]): string[] {
  const sorted = sortViews(views);
  const lines = [`전체 ${sorted.length}건 | ${formatCounts(countByStatus(sorted))}`];
  const shown = sorted.filter((view) => view.status !== "done").slice(0, SUMMARY_MAX_TASK_LINES);
  lines.push(...shown.map(formatTaskLine));
  const rest = sorted.filter((view) => !shown.includes(view));
  if (rest.length > 0) {
    lines.push(`그 외 ${rest.length}건 (${formatCounts(countByStatus(rest))})`);
  }
  return lines;
}

/** 사실 검사 비교용 줄 정리: 앞뒤 공백 제거, 하이픈 "-"·"—"를 긴 줄표 "–"로 */
export function normalizeLine(line: string): string {
  return line.trim().replace(/[-—]/g, "–");
}
