// Design Ref: §2.2·§9 — 브라우저 전용: localStorage 읽기·쓰기
// 서버·테스트에서 import하지 않는다. 저장소를 쓸 수 없어도 앱이 깨지지 않게 모든 접근을 try/catch로 감싼다.
import { createEmptyBoard, parseBoardData } from "../board.ts";
import type { BoardData } from "../types.ts";

/** 저장 칸 이름 (형식 버전 1) */
export const STORAGE_KEY = "task-board:v1";
/** 깨진 데이터를 덮어쓰기 전에 옮겨 두는 칸 */
export const CORRUPT_BACKUP_KEY = "task-board:v1:corrupt-backup";

/**
 * 불러온 결과 상태
 * - ok: 저장된 진행판을 불러옴
 * - empty: 저장된 것이 없음(처음 사용)
 * - unavailable: 이 브라우저에서 저장소를 쓸 수 없음(사생활 보호 모드 등) — 화면에 안내
 * - corrupt: 저장된 값이 깨져 있어 빈 진행판으로 시작(원래 값은 백업 칸에 보관)
 */
export type LoadStatus = "ok" | "empty" | "unavailable" | "corrupt";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    // 실제로 쓰고 지울 수 있는지 확인 (일부 브라우저는 접근은 되지만 쓰기가 막혀 있다)
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** 저장된 진행판을 불러온다. 어떤 경우에도 오류를 내지 않고 쓸 수 있는 진행판을 돌려준다. */
export function loadBoard(): { board: BoardData; status: LoadStatus } {
  const storage = getStorage();
  if (!storage) return { board: createEmptyBoard(), status: "unavailable" };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { board: createEmptyBoard(), status: "unavailable" };
  }
  if (raw === null) return { board: createEmptyBoard(), status: "empty" };

  let parsed: BoardData | null = null;
  try {
    parsed = parseBoardData(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (parsed) return { board: parsed, status: "ok" };

  // 깨진 값은 지우지 않고 백업 칸으로 옮겨 둔다
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // 백업에 실패해도 앱은 계속 동작한다
  }
  return { board: createEmptyBoard(), status: "corrupt" };
}

/** 진행판을 저장한다. 성공하면 true, 저장소를 쓸 수 없거나 용량이 꽉 차면 false. */
export function saveBoard(board: BoardData): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}
