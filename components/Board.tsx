"use client";

// Design Ref: §5.1·§5.3 Board — 진행판 전체 (업무 등록 폼 → 현황 막대 → 업무 카드 → 요약 패널)
import { useState } from "react";
import type { SaveOutcome } from "@/lib/client/board-store.ts";
import { useBoard } from "@/hooks/useBoard.ts";
import { canAddTask } from "@/lib/board.ts";
import { MAX_TASKS } from "@/lib/limits.ts";
import { countByStatus, filterViews, type BoardFilter } from "@/lib/status.ts";
import StatusBar from "./StatusBar";
import SummaryPanel from "./SummaryPanel";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";
import BackupPanel from "./BackupPanel";

const FILTER_OPTIONS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "dueSoon", label: "임박" },
  { value: "overdue", label: "지연" },
];

export default function Board() {
  const { ready, today, board, views, loadStatus, saveFailed, actions } = useBoard();
  const [registration, setRegistration] = useState<{ outcome: SaveOutcome; sequence: number } | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const visibleViews = filterViews(views, filter);
  const counts = countByStatus(views);

  if (!ready) {
    return <p className="py-8 text-center text-sm text-zinc-500">진행판을 불러오는 중입니다…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(loadStatus === "unavailable" || saveFailed) && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          이 브라우저에서는 저장되지 않습니다. 창을 닫으면 입력한 내용이 사라질 수 있습니다.
        </p>
      )}
      {loadStatus === "corrupt" && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          저장된 진행판을 읽을 수 없어 빈 진행판으로 시작합니다. 원래 데이터는 브라우저에 따로 보관해 두었습니다.
        </p>
      )}

      <section
        aria-label="새 업무"
        className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
      >
        <h2 className="mb-3 font-semibold">새 업무</h2>
        <TaskForm
          submitLabel="등록"
          onSubmit={(input) => {
            const outcome = actions.addTask(input);
            setRegistration((previous) => ({ outcome, sequence: (previous?.sequence ?? 0) + 1 }));
            return outcome !== "unchanged";
          }}
          disabledReason={canAddTask(board) ? undefined : `업무는 ${MAX_TASKS}건까지 등록할 수 있습니다.`}
        />
        {registration && (
          <p
            key={registration.sequence}
            role={registration.outcome === "saved" ? "status" : "alert"}
            className={`mt-3 rounded-md px-3 py-2 text-sm ${registration.outcome === "saved" ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
          >
            {registration.outcome === "saved"
              ? "업무를 등록하고 이 브라우저에 저장했습니다."
              : registration.outcome === "memory"
                ? "업무는 화면에 등록됐지만 브라우저에 저장하지 못했습니다. 새로고침하거나 창을 닫으면 사라질 수 있습니다."
                : "업무를 등록하지 못했습니다. 등록 가능한 업무 개수를 확인해주세요."}
          </p>
        )}
      </section>

      <StatusBar views={views} />
      <div className="flex flex-col gap-2" aria-label="업무 상태 필터">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-md border px-3 py-2 text-sm ${filter === option.value ? "border-violet-700 bg-violet-700 text-white" : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950"}`}
            >
              {option.label} {option.value === "all" ? views.length : counts[option.value]}건
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">필터는 업무 목록에만 적용됩니다. 현황과 요약은 전체 업무 기준입니다.</p>
      </div>

      {views.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 등록된 업무가 없습니다. 위에서 첫 업무를 등록해보세요.
        </p>
      ) : visibleViews.length === 0 ? (
        <div role="status" className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm dark:border-zinc-700">
          <p>{filter === "dueSoon" ? "임박" : "지연"} 업무가 없습니다.</p>
          <button type="button" className="mt-2 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600" onClick={() => setFilter("all")}>전체 업무 보기</button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="업무 목록">
          {visibleViews.map((view) => (
            <TaskCard key={view.task.id} view={view} today={today} actions={actions} />
          ))}
        </ul>
      )}

      <SummaryPanel views={views} tasks={board.tasks} revision={board.revision} today={today} />
      <BackupPanel board={board} onRestore={(incoming, expectedRevision) => {
        const result = actions.restoreBoard(incoming, expectedRevision);
        if (result === "saved") { setRegistration(null); setFilter("all"); }
        return result;
      }} />
    </div>
  );
}
