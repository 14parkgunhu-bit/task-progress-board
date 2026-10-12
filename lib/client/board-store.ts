// Design Ref: §2.3 ① — 브라우저 전용: 진행판 상태 저장소
// React의 useSyncExternalStore로 읽는다. 서버에서 그릴 때는 "불러오는 중" 상태를 쓰고,
// 브라우저에서 처음 읽을 때 localStorage에서 불러온다(서버·브라우저 화면 불일치 방지).
import { createEmptyBoard } from "../board.ts";
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

/** 진행판을 바꾸고 저장한다. 바뀐 것이 없으면(같은 객체) 아무것도 하지 않는다. */
export function updateBoard(change: (board: BoardData) => BoardData): void {
  const current = ensureLoaded();
  const next = change(current.board);
  if (next === current.board) return;
  const saved = saveBoard(next);
  state = { ...current, board: next, saveFailed: !saved };
  for (const listener of listeners) listener();
}
