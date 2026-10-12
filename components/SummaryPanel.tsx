"use client";

// Design Ref: §5.3 SummaryPanel — 보고용 요약 (PLAN 작업 13: 기본 요약 + 복사, 임시)
// F 묶음(작업 24)에서 AI 요약으로 바뀌고, 기본 요약은 AI 실패·업무 0건일 때만 쓰게 된다.
import { useState } from "react";
import { buildBasicSummary } from "@/lib/summary.ts";
import type { TaskView } from "@/lib/types.ts";

type CopyState = "idle" | "copied" | "failed";

export default function SummaryPanel({ views }: { views: readonly TaskView[] }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopy() {
    if (!lines) return;
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section
      aria-label="보고용 요약"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">보고용 요약</h2>
        <button
          type="button"
          onClick={() => {
            setLines(buildBasicSummary(views));
            setCopyState("idle");
          }}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          요약 만들기
        </button>
      </div>
      {lines && (
        <>
          <ol className="flex flex-col gap-1 rounded-md bg-zinc-50 p-3 font-mono text-sm dark:bg-zinc-900">
            {lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="mr-auto text-xs text-zinc-500">기본 요약 (앱이 계산한 값으로 만든 요약)</span>
            {copyState === "copied" && <span className="text-green-700 dark:text-green-400">복사했습니다.</span>}
            {copyState === "failed" && <span className="text-red-600">복사하지 못했습니다. 직접 선택해 복사해주세요.</span>}
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-zinc-300 px-3 py-1 dark:border-zinc-600"
            >
              복사
            </button>
          </div>
        </>
      )}
    </section>
  );
}
