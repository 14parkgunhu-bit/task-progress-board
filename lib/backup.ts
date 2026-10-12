// 브라우저 파일 백업의 형식 검사·직렬화·복원 버전 처리 (외부 전송 없음)
import { parseBoardData } from "./board.ts";
import { MAX_BACKUP_FILE_BYTES } from "./limits.ts";
import { BOARD_SCHEMA_VERSION, type BoardData } from "./types.ts";

const BACKUP_FORMAT = "task-board-backup";
export type BackupResult =
  | { ok: true; board: BoardData; exportedAt: string }
  | { ok: false; message: string };

/** 백업에는 앱이 사용하는 업무 필드만 넣고, 중복 ID·잘못된 버전 번호는 거절한다. */
function cleanBoard(value: unknown): BoardData | null {
  const board = parseBoardData(value);
  if (!board || !Number.isSafeInteger(board.revision)) return null;
  const taskIds = new Set<string>();
  for (const task of board.tasks) {
    if (task.id.trim() === "" || taskIds.has(task.id) || !Number.isSafeInteger(task.revision)) return null;
    taskIds.add(task.id);
    const stepIds = new Set<string>();
    for (const step of task.steps) {
      if (step.id.trim() === "" || stepIds.has(step.id)) return null;
      stepIds.add(step.id);
    }
  }
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    revision: board.revision,
    tasks: board.tasks.map(task => ({
      id: task.id, title: task.title, dueDate: task.dueDate, memo: task.memo,
      revision: task.revision, createdAt: task.createdAt, updatedAt: task.updatedAt,
      steps: task.steps.map(step => ({
        id: step.id, title: step.title, ...(step.dueDate ? { dueDate: step.dueDate } : {}),
        done: step.done, source: step.source, edited: step.edited,
      })),
    })),
  };
}

export function createBackup(board: BoardData, exportedAt = new Date().toISOString()): string {
  const cleaned = cleanBoard(board);
  if (!cleaned || !Number.isFinite(Date.parse(exportedAt))) throw new Error("백업할 진행판을 확인해주세요.");
  const content = JSON.stringify({ format: BACKUP_FORMAT, exportedAt, board: cleaned }, null, 2);
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_FILE_BYTES) throw new Error("백업 파일 크기 상한을 넘었습니다.");
  return content;
}

export function readBackup(content: string): BackupResult {
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_FILE_BYTES) return { ok: false, message: "백업 파일이 너무 큽니다. 앱에서 내보낸 백업 파일을 선택해주세요." };
  let value: unknown;
  try { value = JSON.parse(content.replace(/^\uFEFF/, "")); }
  catch { return { ok: false, message: "JSON 파일을 읽을 수 없습니다. 업무 진행판에서 내보낸 백업 파일을 선택해주세요." }; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, message: "업무 진행판의 백업 파일이 아닙니다." };
  const backup = value as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT || typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt))) return { ok: false, message: "업무 진행판에서 내보낸 백업 파일을 선택해주세요." };
  const rawBoard = backup.board;
  if (typeof rawBoard === "object" && rawBoard !== null && (rawBoard as Record<string, unknown>).schemaVersion !== BOARD_SCHEMA_VERSION) return { ok: false, message: "이 앱에서 지원하지 않는 백업 버전입니다." };
  const board = cleanBoard(rawBoard);
  return board ? { ok: true, board, exportedAt: backup.exportedAt } : { ok: false, message: "백업의 업무 데이터가 손상됐거나 허용 범위를 벗어났습니다. 다른 백업 파일을 선택해주세요." };
}

/** 같은 ID를 복원해도 이전 AI 응답이 최신 결과로 취급되지 않도록 버전을 다시 매긴다. */
export function prepareRestoredBoard(current: BoardData, incoming: BoardData): BoardData | null {
  const cleaned = cleanBoard(incoming);
  if (!cleaned || current.revision >= Number.MAX_SAFE_INTEGER) return null;
  const previous = new Map(current.tasks.map(task => [task.id, task.revision]));
  if (cleaned.tasks.some(task => (previous.get(task.id) ?? 0) >= Number.MAX_SAFE_INTEGER)) return null;
  return { ...cleaned, revision: current.revision + 1, tasks: cleaned.tasks.map(task => ({ ...task, revision: (previous.get(task.id) ?? 0) + 1 })) };
}

export function backupCounts(board: BoardData) {
  const steps = board.tasks.flatMap(task => task.steps);
  return { tasks: board.tasks.length, steps: steps.length, checked: steps.filter(step => step.done).length };
}
