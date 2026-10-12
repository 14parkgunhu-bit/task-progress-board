"use client";

// Design Ref: §2.3 ②·§5.3 StepProposal — AI 단계 쪼개기 요청·제안 확인·수정·저장
// PRD 5장 AI 응답 반영 규칙:
// - 마지막 요청의 응답만 반영한다(이전 요청의 응답은 버린다).
// - 요청 뒤 업무가 바뀌었으면(revision 다름) 자동으로 보여주지 않고 [제안 보기]/[다시 요청]을 묻는다.
// - 제안은 [저장]을 눌러야 반영되고, 기존 할 일이 있으면 [뒤에 추가]/[바꾸기]를 고르게 한다.
import { useRef, useState } from "react";
import type { ProposalStepInput } from "@/lib/board.ts";
import { postJson } from "@/lib/client/api.ts";
import { formatMonthDay } from "@/lib/dates.ts";
import { MANUAL_STEP_INITIAL_INPUTS, MAX_STEPS_PER_TASK } from "@/lib/limits.ts";
import type { Task } from "@/lib/types.ts";
import { validateStepDueDate, validateStepTitle } from "@/lib/validate-input.ts";
import type { StepsResponse } from "@/lib/validate-steps.ts";
import type { BoardActions } from "@/hooks/useBoard.ts";
import AiErrorNotice from "./AiErrorNotice";
import ManualStepInput from "./ManualStepInput";

type Row = { title: string; dueDate: string; originalTitle: string; originalDueDate: string };

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "proposal"; rows: Row[]; revision: number; revealed: boolean; choosing: boolean }
  | { kind: "needInfo"; question: string }
  | { kind: "error"; code: string; message: string; retryAfterSec?: number };

type Props = {
  task: Task;
  today: string;
  dDay: number;
  actions: BoardActions;
  /** 업무 수정 폼 열기 (추가 입력 요청을 받았을 때 메모 보충용) */
  onEditTask: () => void;
};

/** 서버 응답의 형태를 확인한다. 예상과 다르면 null (SEC-008) */
function toStepsResponse(data: unknown): StepsResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const value = data as Record<string, unknown>;
  if (value.status === "need_more_info" && typeof value.question === "string") {
    return { status: "need_more_info", question: value.question };
  }
  if (
    value.status === "ok" &&
    Array.isArray(value.steps) &&
    value.steps.every(
      (step) =>
        typeof step === "object" &&
        step !== null &&
        typeof (step as Record<string, unknown>).title === "string" &&
        typeof (step as Record<string, unknown>).dueDate === "string",
    )
  ) {
    return { status: "ok", steps: value.steps as { title: string; dueDate: string }[] };
  }
  return null;
}

const buttonClass ="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-600";
const primaryClass =
  "rounded-md bg-violet-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-40 hover:bg-violet-800";

export default function StepProposal({ task, today, dDay, actions, onEditTask }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const latestRequest = useRef(0);
  const overdue = dDay < 0;

  async function request() {
    const requestId = ++latestRequest.current;
    const revisionAtRequest = task.revision;
    setPhase({ kind: "loading" });
    const result = await postJson<unknown>(
      "/api/steps",
      { title: task.title, dueDate: task.dueDate, memo: task.memo, today },
    );
    // 더 나중에 보낸 요청이 있으면 이 응답은 버린다
    if (requestId !== latestRequest.current) return;
    if (!result.ok) {
      setPhase({ kind: "error", code: result.code, message: result.message, retryAfterSec: result.retryAfterSec });
      return;
    }
    const data = toStepsResponse(result.data);
    if (!data) {
      // 프록시 오류 페이지 등 예상과 다른 응답 (보안 점검 SEC-008)
      setPhase({ kind: "error", code: "AI_INVALID", message: "AI 응답 형식이 올바르지 않습니다." });
      return;
    }
    if (data.status === "need_more_info") {
      setPhase({ kind: "needInfo", question: data.question });
      return;
    }
    setPhase({
      kind: "proposal",
      revision: revisionAtRequest,
      revealed: false,
      choosing: false,
      rows: data.steps.map((step) => ({
        title: step.title,
        dueDate: step.dueDate,
        originalTitle: step.title,
        originalDueDate: step.dueDate,
      })),
    });
  }

  function close() {
    latestRequest.current += 1; // 진행 중인 요청의 응답도 버린다
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "idle") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primaryClass} disabled={overdue} onClick={request}>
          AI로 단계 나누기
        </button>
        {overdue && <span className="text-xs text-red-600">마감일을 먼저 수정하세요.</span>}
      </div>
    );
  }

  const panelClass =
    "flex flex-col gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm dark:border-violet-800 dark:bg-violet-950";

  if (phase.kind === "loading") {
    return (
      <div className={panelClass} aria-live="polite">
        <p>AI가 할 일을 나누는 중입니다… (최대 30초)</p>
        <div>
          <button type="button" className={buttonClass} onClick={close}>
            취소
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    // PLAN 작업 25: 오류 안내 + [다시 시도] + 대체 수단(직접 입력칸 3개)
    const remainingSlots = MAX_STEPS_PER_TASK - task.steps.length;
    return (
      <AiErrorNotice
        code={phase.code}
        message={phase.message}
        retryAfterSec={phase.retryAfterSec}
        onRetry={overdue ? undefined : request}
        onClose={close}
      >
        {remainingSlots > 0 && (
          <ManualStepInput
            title="AI 없이 할 일 직접 입력"
            initialCount={MANUAL_STEP_INITIAL_INPUTS}
            maxAddable={remainingSlots}
            today={today}
            taskDueDate={task.dueDate}
            onCancel={close}
            onSave={(inputs) => {
              actions.addManualSteps(task.id, inputs);
              close();
            }}
          />
        )}
      </AiErrorNotice>
    );
  }

  if (phase.kind === "needInfo") {
    return (
      <div className={panelClass} aria-live="polite">
        <p className="font-medium">AI가 내용을 더 알려달라고 합니다.</p>
        <p>“{phase.question}”</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">메모(또는 업무명)를 보충한 뒤 [다시 요청]을 눌러주세요.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={onEditTask}>
            메모 보충하기
          </button>
          <button type="button" className={primaryClass} onClick={request} disabled={overdue}>
            다시 요청
          </button>
          <button type="button" className={buttonClass} onClick={close}>
            닫기
          </button>
        </div>
      </div>
    );
  }

  // phase.kind === "proposal"
  const stale = task.revision !== phase.revision;
  if (stale && !phase.revealed) {
    return (
      <div className={panelClass} role="status">
        <p>요청 이후 내용이 바뀌어 제안을 적용하지 않았습니다.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => setPhase({ ...phase, revealed: true })}>
            제안 보기
          </button>
          <button type="button" className={primaryClass} onClick={request} disabled={overdue}>
            다시 요청
          </button>
          <button type="button" className={buttonClass} onClick={close}>
            닫기
          </button>
        </div>
      </div>
    );
  }

  const rows = phase.rows;
  const errors = rows.map(
    (row) => validateStepTitle(row.title) ?? validateStepDueDate(row.dueDate, today, task.dueDate),
  );
  const hasError = errors.some(Boolean);
  const doneCount = task.steps.filter((step) => step.done).length;
  const canAppend = task.steps.length + rows.length <= MAX_STEPS_PER_TASK;

  function setRows(next: Row[]) {
    if (phase.kind === "proposal") setPhase({ ...phase, rows: next, choosing: false });
  }

  function save(mode: "append" | "replace") {
    if (mode === "replace" && doneCount > 0) {
      if (!window.confirm(`체크한 할 일 ${doneCount}개가 사라집니다. 바꿀까요?`)) return;
    }
    const inputs: ProposalStepInput[] = rows.map((row) => ({
      title: row.title,
      dueDate: row.dueDate || undefined,
      edited: row.title.trim() !== row.originalTitle || row.dueDate !== row.originalDueDate,
    }));
    actions.applyProposal(task.id, inputs, mode);
    close();
  }

  return (
    <div className={panelClass}>
      <p className="font-medium">AI 제안 ({rows.length}개) — 고친 뒤 [저장]을 눌러야 반영됩니다.</p>
      {stale && <p className="text-xs text-amber-700 dark:text-amber-300">요청 이후 업무가 바뀌었습니다. 내용을 확인하고 저장하세요.</p>}
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-5 text-zinc-500">{index + 1}.</span>
              <input
                className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                value={row.title}
                onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, title: e.target.value } : r)))}
                aria-label={`제안 ${index + 1} 제목`}
              />
              <input
                type="date"
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950 sm:w-40"
                value={row.dueDate}
                min={today}
                max={task.dueDate}
                onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, dueDate: e.target.value } : r)))}
                aria-label={`제안 ${index + 1} 권장 완료일`}
              />
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-red-600 hover:underline"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                빼기
              </button>
            </div>
            {errors[index] && <span className="text-xs text-red-600">{errors[index]}</span>}
            {!errors[index] && row.dueDate && (
              <span className="text-xs text-zinc-500">권장 완료 {formatMonthDay(row.dueDate)}</span>
            )}
          </li>
        ))}
      </ol>

      {phase.choosing ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-violet-200 pt-2 dark:border-violet-800">
          <span className="mr-auto">이미 할 일이 {task.steps.length}개 있습니다. 어떻게 저장할까요?</span>
          <button type="button" className={primaryClass} disabled={!canAppend} onClick={() => save("append")}>
            뒤에 추가
          </button>
          <button type="button" className={buttonClass} onClick={() => save("replace")}>
            바꾸기
          </button>
          <button type="button" className={buttonClass} onClick={() => setPhase({ ...phase, choosing: false })}>
            취소
          </button>
          {!canAppend && (
            <span className="w-full text-xs text-red-600">
              뒤에 추가하면 할 일이 {MAX_STEPS_PER_TASK}개를 넘습니다. 제안을 줄이거나 [바꾸기]를 선택하세요.
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonClass} onClick={close}>
            취소
          </button>
          <button
            type="button"
            className={primaryClass}
            disabled={rows.length === 0 || hasError}
            onClick={() =>
              task.steps.length === 0 ? save("replace") : setPhase({ ...phase, choosing: true })
            }
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}
