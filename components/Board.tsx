"use client";

// Design Ref: §5.1·§5.3 Board — 진행판 전체 (업무 등록 폼 → 현황 막대 → 업무 카드 → 요약 패널)
import { useBoard } from "@/hooks/useBoard.ts";
import { canAddTask } from "@/lib/board.ts";
import { MAX_TASKS } from "@/lib/limits.ts";
import StatusBar from "./StatusBar";
import SummaryPanel from "./SummaryPanel";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";

export default function Board() {
  const { ready, today, board, views, loadStatus, saveFailed, actions } = useBoard();

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
          onSubmit={actions.addTask}
          disabledReason={canAddTask(board) ? undefined : `업무는 ${MAX_TASKS}건까지 등록할 수 있습니다.`}
        />
      </section>

      <StatusBar views={views} />

      {views.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 등록된 업무가 없습니다. 위에서 첫 업무를 등록해보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="업무 목록">
          {views.map((view) => (
            <TaskCard key={view.task.id} view={view} today={today} actions={actions} />
          ))}
        </ul>
      )}

      <SummaryPanel views={views} tasks={board.tasks} revision={board.revision} today={today} />
    </div>
  );
}
