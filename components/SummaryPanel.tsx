"use client";

// Design Ref: §2.3 ③·§5.3 SummaryPanel — 보고용 요약 (PLAN 작업 24)
// - 평소에는 AI 요약, AI 실패·업무 0건일 때만 기본 요약을 보여준다.
// - 마지막 요청의 응답만 반영한다.
// - 요약을 만든 뒤 진행판이나 날짜가 바뀌면 "바뀌었음" + [다시 요약]을 보여주고, 그동안 복사를 막는다.
import { useRef, useState } from "react";
import { postJson } from "@/lib/client/api.ts";
import { formatWait } from "@/lib/format-wait.ts";
import { buildBasicSummary, type SummaryTaskInput } from "@/lib/summary.ts";
import type { Task, TaskView } from "@/lib/types.ts";

type SummarySource = "ai" | "fallback" | "basic";
type SummaryResponse = { source: SummarySource; lines: string[]; reason?: string };

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; lines: string[]; source: SummarySource | "local"; note?: string; revision: number; today: string };

type CopyState = "idle" | "copied" | "failed";

type Props = {
  /** 화면 표시용 계산 결과 (로컬 기본 요약에 사용) */
  views: readonly TaskView[];
  /** 등록 순서 그대로의 업무 목록 (서버에 보낼 개수 계산용) */
  tasks: readonly Task[];
  /** 보드 전체 버전 번호 */
  revision: number;
  today: string;
};

/** 서버 응답의 형태를 확인한다. 예상과 다르면 null (보안 점검 SEC-008) */
function toSummaryResponse(data: unknown): SummaryResponse | null {
  if (typeof data !== "object" || data === null) return null;
  const value = data as Record<string, unknown>;
  const sourceOk = value.source === "ai" || value.source === "fallback" || value.source === "basic";
  const linesOk = Array.isArray(value.lines) && value.lines.every((line) => typeof line === "string");
  return sourceOk && linesOk ? { source: value.source as SummarySource, lines: value.lines as string[] } : null;
}

const SOURCE_LABEL:Record<SummarySource | "local", string> = {
  ai: "AI 요약 (앱이 계산한 값과 대조를 통과함)",
  fallback: "AI 요약을 받지 못해 기본 요약을 보여줍니다.",
  basic: "업무가 없어 기본 요약을 보여줍니다.",
  local: "기본 요약을 보여줍니다.",
};

export default function SummaryPanel({ views, tasks, revision, today }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const latestRequest = useRef(0);

  async function requestSummary() {
    const requestId = ++latestRequest.current;
    const revisionAtRequest = revision;
    const todayAtRequest = today;
    // 요청한 시점의 기본 요약 — 대체 요약은 이 값으로 보여준다(응답이 늦게 와도 요청 시점의 버전과 내용이 일치)
    const localLines = buildBasicSummary(views);
    // 업무가 0건이면 AI도 서버도 부르지 않고 화면에서 바로 기본 요약을 보여준다 (PRD must 2)
    if (tasks.length === 0) {
      setCopyState("idle");
      setPhase({ kind: "result", lines: localLines, source: "basic", revision: revisionAtRequest, today: todayAtRequest });
      return;
    }
    // 메모·할 일 제목은 보내지 않는다 (DESIGN 7장 전송 최소화)
    const payload: SummaryTaskInput[] = tasks.map((task) => ({
      title: task.title,
      dueDate: task.dueDate,
      total: task.steps.length,
      done: task.steps.filter((step) => step.done).length,
    }));
    setCopyState("idle");
    setPhase({ kind: "loading" });
    const result = await postJson<unknown>("/api/summary", { today: todayAtRequest, tasks: payload });
    if (requestId !== latestRequest.current) return; // 더 나중 요청이 있으면 버린다
    const data = result.ok ? toSummaryResponse(result.data) : null;
    if (data) {
      setPhase({
        kind: "result",
        lines: data.lines,
        source: data.source,
        revision: revisionAtRequest,
        today: todayAtRequest,
      });
    } else {
      // AI를 부르지 못한 경우(네트워크·입력·서버 설정·형식이 틀린 응답 등)에도 브라우저에서 같은 규칙으로 기본 요약을 만든다
      const reason = result.ok ? "AI 응답 형식이 올바르지 않습니다." : result.message;
      const wait =
        !result.ok && result.retryAfterSec !== undefined
          ? ` 약 ${formatWait(result.retryAfterSec)} 뒤에 다시 시도하세요.`
          : "";
      setPhase({
        kind: "result",
        lines: localLines,
        source: "local",
        note: `${reason}${wait} 기본 요약을 대신 보여줍니다.`,
        revision: revisionAtRequest,
        today: todayAtRequest,
      });
    }
  }

  const stale = phase.kind === "result" && (phase.revision !== revision || phase.today !== today);

  async function handleCopy() {
    if (phase.kind !== "result" || stale) return;
    try {
      await navigator.clipboard.writeText(phase.lines.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const failed = phase.kind === "result" && (phase.source === "fallback" || phase.source === "local");

  return (
    <section
      aria-label="보고용 요약"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">보고용 요약</h2>
        <button
          type="button"
          onClick={requestSummary}
          disabled={phase.kind === "loading"}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {phase.kind === "result" ? (failed && !stale ? "다시 시도" : "다시 요약") : "요약 만들기"}
        </button>
      </div>

      {phase.kind === "loading" && (
        <p className="text-sm text-zinc-500" aria-live="polite">
          AI가 요약하는 중입니다… (최대 40초 정도)
        </p>
      )}

      {phase.kind === "result" && (
        <>
          {stale && (
            <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              ⚠ 요약을 요청한 뒤 진행판이 바뀌었습니다. 위의 [다시 요약] 버튼을 눌러주세요.
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {phase.note ?? SOURCE_LABEL[phase.source]}
            </p>
          )}
          <ol
            className={`flex flex-col gap-1 rounded-md bg-zinc-50 p-3 font-mono text-sm dark:bg-zinc-900 ${stale ? "opacity-50" : ""}`}
          >
            {phase.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <span className="mr-auto text-xs text-zinc-500">{failed ? "" : SOURCE_LABEL[phase.source]}</span>
            {copyState === "copied" && <span className="text-green-700 dark:text-green-400">복사했습니다.</span>}
            {copyState === "failed" && <span className="text-red-600">복사하지 못했습니다. 직접 선택해 복사해주세요.</span>}
            <button
              type="button"
              onClick={handleCopy}
              disabled={stale}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-600"
            >
              복사
            </button>
          </div>
        </>
      )}
    </section>
  );
}
