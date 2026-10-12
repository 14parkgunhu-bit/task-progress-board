"use client";

// Design Ref: §5.1·§5.3 TaskCard — 업무 1건: 상태 배지·D-day·진행률 막대·할 일·수정/삭제
import { useState } from "react";
import { formatDDay, formatMonthDay } from "@/lib/dates.ts";
import { STATUS_LABEL } from "@/lib/status.ts";
import type { TaskView } from "@/lib/types.ts";
import type { BoardActions } from "@/hooks/useBoard.ts";
import StepList from "./StepList";
import TaskForm from "./TaskForm";
import { STATUS_BADGE_CLASS, STATUS_BAR_CLASS, STATUS_BORDER_CLASS } from "./status-style";

type Props = { view: TaskView; today: string; actions: BoardActions };

export default function TaskCard({ view, today, actions }: Props) {
  const { task, status, progress, doneCount, total, dDay } = view;
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    const message =
      total > 0
        ? `"${task.title}" 업무를 삭제할까요? 할 일 ${total}개도 함께 사라집니다.`
        : `"${task.title}" 업무를 삭제할까요?`;
    if (window.confirm(message)) actions.deleteTask(task.id);
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border border-l-4 border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950 ${STATUS_BORDER_CLASS[status]}`}
    >
      {editing ? (
        <TaskForm
          initial={{ title: task.title, dueDate: task.dueDate, memo: task.memo }}
          submitLabel="수정 저장"
          onCancel={() => setEditing(false)}
          onSubmit={(value) => {
            actions.updateTask(task.id, value);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <h3 className={`flex-1 font-semibold ${status === "done" ? "text-zinc-500" : ""}`}>
              {task.title}
            </h3>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              마감 {formatMonthDay(task.dueDate)}
            </span>
            <span
              className={`text-sm font-semibold ${
                status === "overdue" || status === "dueSoon" ? "text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {formatDDay(dDay)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`${task.title} 진행률`}
            >
              <div className={`h-full ${STATUS_BAR_CLASS[status]}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{progress}%</span>
            <span className="text-xs text-zinc-500 tabular-nums">
              ({doneCount}/{total})
            </span>
          </div>

          {task.memo && (
            <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{task.memo}</p>
          )}

          <StepList task={task} today={today} actions={actions} />

          <div className="flex justify-end gap-3 border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
            <button type="button" className="text-zinc-600 hover:underline dark:text-zinc-400" onClick={() => setEditing(true)}>
              수정
            </button>
            <button type="button" className="text-zinc-600 hover:text-red-600 hover:underline dark:text-zinc-400" onClick={handleDelete}>
              삭제
            </button>
          </div>
        </>
      )}
    </li>
  );
}
