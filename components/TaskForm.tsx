"use client";

// Design Ref: §5.3 TaskForm — 업무 등록·수정 폼 (글자 수 표시, 업무명 50자·메모 1,000자, 마감일 필수)
import { useId, useState } from "react";
import { MAX_MEMO_LENGTH, MAX_TASK_TITLE_LENGTH } from "@/lib/limits.ts";
import { countChars, validateTaskInput, type TaskInput } from "@/lib/validate-input.ts";

type Props = {
  initial?: TaskInput;
  submitLabel: string;
  onSubmit: (value: TaskInput) => void;
  onCancel?: () => void;
  /** 등록을 막아야 할 때(업무 100건 상한 등) 안내 문구 */
  disabledReason?: string;
};

const EMPTY: TaskInput = { title: "", dueDate: "", memo: "" };

export default function TaskForm({ initial, submitLabel, onSubmit, onCancel, disabledReason }: Props) {
  const [value, setValue] = useState<TaskInput>(initial ?? EMPTY);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const id = useId();
  const { ok, errors, value: cleaned } = validateTaskInput(value);
  const titleCount = countChars(value.title.trim());
  const memoCount = countChars(value.memo.trim());
  // 글자 수 초과는 바로 보여주고, 빈 칸 오류는 [등록]을 눌렀을 때 보여준다
  const showError = (field: keyof TaskInput, overLimit: boolean) =>
    errors[field] && (triedSubmit || overLimit) ? errors[field] : null;
  const titleError = showError("title", titleCount > MAX_TASK_TITLE_LENGTH);
  const dueError = showError("dueDate", false);
  const memoError = showError("memo", memoCount > MAX_MEMO_LENGTH);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTriedSubmit(true);
    if (!ok || disabledReason) return;
    onSubmit(cleaned);
    if (!initial) {
      setValue(EMPTY);
      setTriedSubmit(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm" htmlFor={`${id}-title`}>
          <span className="flex justify-between">
            <span className="font-medium">업무명</span>
            <span className={titleCount > MAX_TASK_TITLE_LENGTH ? "text-red-600" : "text-zinc-500"}>
              {titleCount}/{MAX_TASK_TITLE_LENGTH}
            </span>
          </span>
          <input
            id={`${id}-title`}
            className={inputClass}
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
            placeholder="예: 가을 체육행사 준비"
            aria-invalid={Boolean(titleError)}
          />
          {titleError && <span className="text-red-600">{titleError}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-44" htmlFor={`${id}-due`}>
          <span className="font-medium">마감일</span>
          <input
            id={`${id}-due`}
            type="date"
            className={inputClass}
            value={value.dueDate}
            onChange={(e) => setValue({ ...value, dueDate: e.target.value })}
            aria-invalid={Boolean(dueError)}
          />
          {dueError && <span className="text-red-600">{dueError}</span>}
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-memo`}>
        <span className="flex justify-between">
          <span className="font-medium">메모 (선택)</span>
          <span className={memoCount > MAX_MEMO_LENGTH ? "text-red-600" : "text-zinc-500"}>
            {memoCount.toLocaleString("ko-KR")}/{MAX_MEMO_LENGTH.toLocaleString("ko-KR")}
          </span>
        </span>
        <textarea
          id={`${id}-memo`}
          className={`${inputClass} min-h-16`}
          value={value.memo}
          onChange={(e) => setValue({ ...value, memo: e.target.value })}
          placeholder="업무 배경이나 조건을 적으면 AI가 할 일을 나눌 때 참고합니다. (공개 등급 정보만)"
          aria-invalid={Boolean(memoError)}
        />
        {memoError && <span className="text-red-600">{memoError}</span>}
      </label>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {disabledReason && <span className="mr-auto text-sm text-red-600">{disabledReason}</span>}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={Boolean(disabledReason)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
