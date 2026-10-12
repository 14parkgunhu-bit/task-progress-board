"use client";

// Design Ref: §5.1 헤더 [접근 코드 ●설정됨] · §7 접근 코드 — PLAN 작업 26 (화면 입력칸)
// 공개 배포 주소에서는 접근 코드를 입력해야 AI 기능을 쓸 수 있다. 값은 화면에 그대로 보이지 않게 한다.
import { useState, useSyncExternalStore } from "react";
import {
  getAccessCode,
  getServerAccessCode,
  setAccessCode,
  subscribeAccessCode,
} from "@/lib/client/access-code-store.ts";

export default function AccessCodeInput() {
  const code = useSyncExternalStore(subscribeAccessCode, getAccessCode, getServerAccessCode);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-600"
        aria-label={code ? "접근 코드 설정됨, 바꾸기" : "접근 코드 입력"}
      >
        <span aria-hidden="true" className={code ? "text-green-600" : "text-zinc-400"}>
          ●
        </span>
        접근 코드 {code ? "설정됨" : "입력"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setAccessCode(draft);
        setOpen(false);
      }}
    >
      <input
        type="password"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="접근 코드"
        aria-label="접근 코드"
        className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
      />
      <button type="submit" className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
        저장
      </button>
      {code && (
        <button
          type="button"
          onClick={() => {
            setAccessCode("");
            setOpen(false);
          }}
          className="text-xs text-zinc-500 hover:underline"
        >
          지우기
        </button>
      )}
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:underline">
        닫기
      </button>
    </form>
  );
}
