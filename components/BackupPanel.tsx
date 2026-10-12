"use client";

// 로컬 JSON 파일로만 백업·복원한다. 미리보기와 확인 전에는 진행판을 바꾸지 않는다.
import { useRef, useState } from "react";
import { backupCounts, createBackup, readBackup } from "@/lib/backup.ts";
import type { RestoreOutcome } from "@/lib/client/board-store.ts";
import { MAX_BACKUP_FILE_BYTES } from "@/lib/limits.ts";
import type { BoardData } from "@/lib/types.ts";

type Props = { board: BoardData; onRestore: (board: BoardData, expectedRevision: number) => RestoreOutcome };
type Pending = { board: BoardData; filename: string; exportedAt: string; expectedRevision: number };
const buttonClass = "rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-600";

export default function BackupPanel({ board, onRestore }: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const latestRead = useRef(0);
  const stale = pending !== null && pending.expectedRevision !== board.revision;
  const counts = pending ? backupCounts(pending.board) : null;

  function download() {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const content = createBackup(board);
      url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      link = document.createElement("a");
      link.href = url;
      link.download = `업무-진행판-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      setNotice({ error: false, text: "백업 파일 다운로드를 요청했습니다. 브라우저 다운로드 폴더를 확인해주세요." });
    } catch {
      setNotice({ error: true, text: "백업을 내보내지 못했습니다. 브라우저 다운로드 설정을 확인해주세요." });
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      }
    }
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일도 다시 선택할 수 있게 한다.
    if (!file) return;
    const requestId = ++latestRead.current;
    setPending(null); setConfirmed(false); setNotice(null);
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setReading(false);
      setNotice({ error: true, text: `파일은 ${MAX_BACKUP_FILE_BYTES / 1024 / 1024}MB까지 읽을 수 있습니다.` });
      return;
    }
    setReading(true);
    try {
      const result = readBackup(await file.text());
      if (requestId !== latestRead.current) return;
      if (!result.ok) setNotice({ error: true, text: result.message });
      else setPending({ board: result.board, filename: file.name, exportedAt: result.exportedAt, expectedRevision: board.revision });
    } catch {
      if (requestId === latestRead.current) setNotice({ error: true, text: "파일을 읽지 못했습니다. 파일을 다시 선택해주세요." });
    } finally {
      if (requestId === latestRead.current) setReading(false);
    }
  }

  function cancel() {
    latestRead.current++; setReading(false); setPending(null); setConfirmed(false); setNotice(null);
  }

  function restore() {
    if (!pending || !confirmed || stale) return;
    const result = onRestore(pending.board, pending.expectedRevision);
    setConfirmed(false);
    if (result === "saved") {
      setPending(null);
      setNotice({ error: false, text: `업무 ${pending.board.tasks.length}건을 복원하고 이 브라우저에 저장했습니다.` });
    } else if (result === "changed") {
      setNotice({ error: true, text: "진행판이 바뀌어 복원하지 않았습니다. 미리보기를 갱신하고 다시 확인해주세요." });
    } else {
      setNotice({ error: true, text: "브라우저에 저장하지 못해 복원하지 않았습니다. 기존 진행판은 유지됩니다." });
    }
  }

  return (
    <section aria-label="백업과 복원" className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="font-semibold">백업·복원</h2>
      <p className="text-xs text-zinc-500">업무명·메모가 포함된 JSON 파일을 이 기기에 저장합니다. 외부 서비스로 전송하지 않습니다.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={download}>백업 내보내기</button>
        <label className="flex flex-col gap-1 text-sm">
          <span>백업 파일 선택</span>
          <input type="file" accept=".json,application/json" onChange={chooseFile} aria-label="백업 파일 선택" className="max-w-full text-sm" />
        </label>
      </div>
      {reading && <p role="status" className="text-sm text-zinc-500">백업 파일을 읽는 중입니다…</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${notice.error ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"}`}>{notice.text}</p>}
      {pending && counts && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="break-all">선택한 파일: {pending.filename}</p>
          <p>백업 시각: {new Date(pending.exportedAt).toLocaleString("ko-KR")}</p>
          <p>복원 범위: 업무 {counts.tasks}건 · 할 일 {counts.steps}개 · 완료 체크 {counts.checked}개</p>
          <p className="font-medium">현재 업무 {board.tasks.length}건을 백업의 업무 {counts.tasks}건으로 바꿉니다. 기존 목록에 추가하는 방식이 아닙니다.</p>
          {stale && <p role="alert">미리보기 이후 진행판이 바뀌었습니다. 아래에서 미리보기를 갱신하고 다시 확인해주세요.</p>}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confirmed && !stale} disabled={stale} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-5 shrink-0" />
            <span>기존 업무 {board.tasks.length}건을 백업의 {counts.tasks}건으로 바꾸는 데 동의합니다.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {stale && <button type="button" className={buttonClass} onClick={() => { setPending({ ...pending, expectedRevision: board.revision }); setConfirmed(false); setNotice(null); }}>미리보기 갱신</button>}
            <button type="button" className={buttonClass} onClick={cancel}>취소</button>
            <button type="button" className="rounded-md bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-40" disabled={!confirmed || stale} onClick={restore}>확인한 범위로 복원</button>
          </div>
        </div>
      )}
      {reading && <button type="button" className={buttonClass} onClick={cancel}>읽기 취소</button>}
    </section>
  );
}
