"use client";

// Design Ref: §5.3 ManualStepInput — 할 일 직접 입력칸
// 빈 칸은 무시하고, 1개 이상 입력해야 저장된다. 제목 1~30자, 권장 완료일은 선택(오늘~업무 마감일).
// AI 단계 쪼개기가 실패했을 때의 대체 수단으로도 쓴다(처음 3칸). (PRD 5장 직접 입력 규칙)
import { useState } from "react";
import type { ManualStepInput as StepInput } from "@/lib/board.ts";
import { MAX_STEP_TITLE_LENGTH } from "@/lib/limits.ts";
import { countChars, validateStepDueDate, validateStepTitle } from "@/lib/validate-input.ts";

type Props = {
  initialCount: number;
  /** 이 업무에 더 넣을 수 있는 할 일 개수 (50개 상한) */
  maxAddable: number;
  today: string;
  taskDueDate: string;
  onSave: (inputs: StepInput[]) => void;
  onCancel: () => void;
  title?: string;
};

export default function ManualStepInput({
  initialCount,
  maxAddable,
  today,
  taskDueDate,
  onSave,
  onCancel,
  title = "할 일 직접 입력",
}: Props) {
  const [rows, setRows] = useState<StepInput[]>(() =>
    Array.from({ length: Math.max(1, Math.min(initialCount, maxAddable)) }, () => ({ title: "", dueDate: "" })),
  );

  const checked = rows.map((row) => {
    if (row.title.trim() === "") return { filled: false, error: null as string | null };
    return {
      filled: true,
      error: validateStepTitle(row.title) ?? validateStepDueDate(row.dueDate, today, taskDueDate),
    };
  });
  const filledCount = checked.filter((row) => row.filled).length;
  const hasError = checked.some((row) => row.error);
  const canSave = filledCount >= 1 && filledCount <= maxAddable && !hasError;

  function setRow(index: number, patch: Partial<StepInput>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium">{title}</p>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={row.title}
              onChange={(e) => setRow(index, { title: e.target.value })}
              placeholder={`할 일 ${index + 1} (예: 행사 장소 예약하기)`}
              aria-label={`할 일 ${index + 1} 제목`}
              aria-invalid={Boolean(checked[index].error)}
            />
            <input
              type="date"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 sm:w-40"
              value={row.dueDate ?? ""}
              min={today}
              max={taskDueDate}
              onChange={(e) => setRow(index, { dueDate: e.target.value })}
              aria-label={`할 일 ${index + 1} 권장 완료일 (선택)`}
            />
          </div>
          <span className="text-xs text-zinc-500">
            {countChars(row.title.trim())}/{MAX_STEP_TITLE_LENGTH}
            {checked[index].error && <span className="ml-2 text-red-600">{checked[index].error}</span>}
          </span>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRows([...rows, { title: "", dueDate: "" }])}
          disabled={rows.length >= maxAddable}
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-600"
        >
          + 칸 추가
        </button>
        <span className="mr-auto text-xs text-zinc-500">빈 칸은 저장하지 않습니다.</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
        >
          취소
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(rows)}
          className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          저장
        </button>
      </div>
    </div>
  );
}
