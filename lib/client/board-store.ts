// Design Ref: §2.3 ① — 브라우저 전용: 진행판 상태 저장소
// React의 useSyncExternalStore로 읽는다. 서버에서 그릴 때는 "불러오는 중" 상태를 쓰고,
// 브라우저에서 처음 읽을 때 localStorage에서 불러온다(서버·브라우저 화면 불일치 방지).
import { createEmptyBoard } from "../board.ts";
import { prepareRestoredBoard } from "../backup.ts";
import type { BoardData } from "../types.ts";
import { loadBoard, saveBoard, type LoadStatus } from "./storage.ts";

export type BoardState = {
  board: BoardData;
  /** "loading"은 서버에서 그릴 때만 쓰인다 */
  loadStatus: LoadStatus | "loading";
  /** 마지막 저장이 실패했는지 (저장소 막힘·용량 초과) */
  saveFailed: boolean;
};

const SERVER_STATE: BoardState = {
  board: createEmptyBoard(),
  loadStatus: "loading",
  saveFailed: false,
};

let state: BoardState | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): BoardState {
  if (state === null) {
    const { board, status } = loadBoard();
    state = { board, loadStatus: status, saveFailed: false };
  }
  return state;
}

export function subscribeBoard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBoardSnapshot(): BoardState {
  return ensureLoaded();
}

export function getServerBoardSnapshot(): BoardState {
  return SERVER_STATE;
}

/** 변경 결과: saved = 브라우저 저장, memory = 화면에만 반영, unchanged = 등록/변경 안 됨. */
export type SaveOutcome = "saved" | "memory" | "unchanged";

/** 진행판을 바꾸고 실제 저장 결과를 돌려준다. */
export function updateBoard(change: (board: BoardData) => BoardData): SaveOutcome {
  const current = ensureLoaded();
  const next = change(current.board);
  if (next === current.board) return "unchanged";
  const saved = saveBoard(next);
  state = { ...current, board: next, saveFailed: !saved };
  for (const listener of listeners) listener();
  return saved ? "saved" : "memory";
}

/** 복원은 확인한 버전에서만 저장하고, 실패 시 기존 화면·저장 데이터를 유지한다. */
export type RestoreOutcome = "saved" | "failed" | "changed";
export function restoreBoard(incoming: BoardData, expectedRevision: number): RestoreOutcome {
  const current = ensureLoaded();
  if (current.board.revision !== expectedRevision) return "changed";
  const restored = prepareRestoredBoard(current.board, incoming);
  if (!restored || !saveBoard(restored)) return "failed";
  state = { board: restored, loadStatus: "ok", saveFailed: false };
  for (const listener of listeners) listener();
  return "saved";
}
