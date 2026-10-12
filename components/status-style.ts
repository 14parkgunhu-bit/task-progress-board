// Design Ref: §5.1 — 상태 색: 완료 = 회색, 지연 = 진한 빨강, 임박 = 빨강, 정상 = 기본색
// 색만으로 구분하지 않도록 화면에는 항상 상태 글자(배지)를 함께 쓴다.
import type { TaskStatus } from "@/lib/types.ts";

/** 상태 배지 색 */
export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  done: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  overdue: "bg-red-800 text-white",
  dueSoon: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  normal: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};

/** 업무 카드 왼쪽 테두리 색 */
export const STATUS_BORDER_CLASS: Record<TaskStatus, string> = {
  done: "border-l-zinc-400",
  overdue: "border-l-red-800",
  dueSoon: "border-l-red-500",
  normal: "border-l-zinc-300 dark:border-l-zinc-600",
};

/** 진행률 막대 색 */
export const STATUS_BAR_CLASS: Record<TaskStatus, string> = {
  done: "bg-zinc-400",
  overdue: "bg-red-800",
  dueSoon: "bg-red-500",
  normal: "bg-blue-600",
};
