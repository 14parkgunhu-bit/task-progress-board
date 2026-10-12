"use client";

// Design Ref: §5.3 StepList — 할 일 체크·추가·수정·삭제 (제목 1~30자, 날짜 선택, 50개 상한)
import { useState } from "react";
import { formatMonthDay } from "@/lib/dates.ts";
import { MAX_STEPS_PER_TASK } from "@/lib/limits.ts";
import type { Task } from "@/lib/types.ts";
import { validateStepDueDate, validateStepTitle } from "@/lib/validate-input.ts";
import type { BoardActions } from "@/hooks/useBoard.ts";
import ManualStepInput from "./ManualStepInput";

type Props = { task: Task; today: string; actions: BoardActions };

export default function StepList({ task, today, actions }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", dueDate: "" });
  const remainingSlots = MAX_STEPS_PER_TASK - task.steps.length;

  const draftError = editingId
    ? (validateStepTitle(draft.title) ?? validateStepDueDate(draft.dueDate, today, task.dueDate))
    : null;

  return (
    <div className="flex flex-col gap-2">
      {task.steps.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 할 일이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {task.steps.map((step) =>
            editingId === step.id ? (
              <li key={step.id} className="flex flex-col gap-1 rounded-md bg-zinc-50 p-2 dark:bg-zinc-900">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    aria-label="할 일 제목"
                  />
                  <input
                    type="date"
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 sm:w-40"
                    value={draft.dueDate}
                    min={today}
                    max={task.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                    aria-label="권장 완료일 (선택)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {draftError && <span className="mr-auto text-xs text-red-600">{draftError}</span>}
                  <button
                    type="button"
                    className="ml-auto rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                    onClick={() => setEditingId(null)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(draftError)}
                    className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                    onClick={() => {
                      actions.updateStep(task.id, step.id, draft);
                      setEditingId(null);
                    }}
                  >
                    저장
                  </button>
                </div>
              </li>
            ) : (
              <li key={step.id} className="group flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={step.done}
                    onChange={() => actions.toggleStep(task.id, step.id)}
                  />
                  <span className={step.done ? "text-zinc-400 line-through" : ""}>{step.title}</span>
                  {step.dueDate && (
                    <span className="text-xs text-zinc-500">~{formatMonthDay(step.dueDate)}</span>
                  )}
                  {step.source === "ai" && (
                    <span className="rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      AI
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:underline"
                  onClick={() => {
                    setDraft({ title: step.title, dueDate: step.dueDate ?? "" });
                    setEditingId(step.id);
                  }}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-red-600 hover:underline"
                  onClick={() => actions.deleteStep(task.id, step.id)}
                  aria-label={`할 일 "${step.title}" 삭제`}
                >
                  삭제
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <ManualStepInput
          initialCount={1}
          maxAddable={remainingSlots}
          today={today}
          taskDueDate={task.dueDate}
          onCancel={() => setAdding(false)}
          onSave={(inputs) => {
            actions.addManualSteps(task.id, inputs);
            setAdding(false);
          }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={remainingSlots <= 0}
            onClick={() => setAdding(true)}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-600"
          >
            + 할 일 추가
          </button>
          {remainingSlots <= 0 && (
            <span className="text-xs text-red-600">할 일은 업무당 {MAX_STEPS_PER_TASK}개까지입니다.</span>
          )}
        </div>
      )}
    </div>
  );
}
