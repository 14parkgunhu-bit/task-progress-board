"use client";

// Design Ref: §5.1 헤더 [접근 코드 ●설정됨] · §7 접근 코드 — PLAN 작업 26 (화면 입력칸)
// 공개 배포 주소에서는 접근 코드를 입력해야 AI 기능을 쓸 수 있다. 값은 화면에 그대로 보이지 않게 한다.
// "이 기기에서 기억하기"를 켜면 개인 폰·PC에서 한 번만 넣으면 된다(공용 PC에서는 끄기).
import { useState, useSyncExternalStore } from "react";
import {
  getAccessCode,
  getAccessCodeRemembered,
  getServerAccessCode,
  getServerAccessCodeRemembered,
  setAccessCode,
  subscribeAccessCode,
} from "@/lib/client/access-code-store.ts";

export default function AccessCodeInput() {
  const code = useSyncExternalStore(subscribeAccessCode, getAccessCode, getServerAccessCode);
  const remembered = useSyncExternalStore(
    subscribeAccessCode,
    getAccessCodeRemembered,
    getServerAccessCodeRemembered,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [remember, setRemember] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setRemember(remembered);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-600"
        aria-label={code ? `접근 코드 설정됨${remembered ? "(이 기기에 기억됨)" : ""}, 바꾸기` : "접근 코드 입력"}
      >
        <span aria-hidden="true" className={code ? "text-green-600" : "text-zinc-400"}>
          ●
        </span>
        접근 코드 {code ? (remembered ? "기억됨" : "설정됨") : "입력"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950"
      onSubmit={(event) => {
        event.preventDefault();
        setAccessCode(draft, remember);
        setOpen(false);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="접근 코드"
          aria-label="접근 코드"
          className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
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
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          className="size-4 shrink-0"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        이 기기에서 기억하기 <span className="text-zinc-400">(공용 PC에서는 끄세요)</span>
      </label>
    </form>
  );
}
