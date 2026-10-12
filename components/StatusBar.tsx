// Design Ref: §5.3 StatusBar — 전체·상태별 건수
import { countByStatus, STATUS_LABEL } from "@/lib/status.ts";
import type { TaskStatus, TaskView } from "@/lib/types.ts";
import { STATUS_BADGE_CLASS } from "./status-style";

const ORDER: TaskStatus[] = ["done", "overdue", "dueSoon", "normal"];

export default function StatusBar({ views }: { views: readonly TaskView[] }) {
  const counts = countByStatus(views);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="진행판 현황">
      <span className="font-semibold">전체 {views.length}건</span>
      <span className="text-zinc-400">|</span>
      {ORDER.map((status) => (
        <span key={status} className={`rounded px-2 py-0.5 ${STATUS_BADGE_CLASS[status]}`}>
          {STATUS_LABEL[status]} {counts[status]}
        </span>
      ))}
    </div>
  );
}
