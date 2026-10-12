// Design Ref: §5.3 Board — 진행판 상태와 조작을 화면에 연결하는 훅 (브라우저 전용)
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addManualSteps,
  addTask,
  applyProposal,
  deleteStep,
  deleteTask,
  toggleStep,
  updateStep,
  updateTask,
  type ManualStepInput,
  type ProposalStepInput,
} from "@/lib/board.ts";
import {
  getBoardSnapshot,
  getServerBoardSnapshot,
  subscribeBoard,
  updateBoard,
  restoreBoard as restoreStoredBoard,
} from "@/lib/client/board-store.ts";
import {
  getServerTodaySnapshot,
  getTodaySnapshot,
  subscribeToday,
} from "@/lib/client/today-store.ts";
import { buildViews } from "@/lib/status.ts";
import type { BoardData } from "@/lib/types.ts";
import type { TaskInput } from "@/lib/validate-input.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export function useBoard() {
  const state = useSyncExternalStore(subscribeBoard, getBoardSnapshot, getServerBoardSnapshot);
  const today = useSyncExternalStore(subscribeToday, getTodaySnapshot, getServerTodaySnapshot);
  const ready = state.loadStatus !== "loading" && today !== "";

  // 계산은 lib 함수 한 곳에서만 (CLAUDE.md 핵심 정의)
  const views = useMemo(
    () => (ready ? buildViews(state.board.tasks, today) : []),
    [ready, state.board.tasks, today],
  );

  const actions = {
    restoreBoard: useCallback((incoming: BoardData, expectedRevision: number) => restoreStoredBoard(incoming, expectedRevision), []),
    addTask: useCallback((input: TaskInput) => updateBoard((b) => addTask(b, input, nowIso())), []),
    updateTask: useCallback(
      (taskId: string, input: TaskInput) => updateBoard((b) => updateTask(b, taskId, input, nowIso())),
      [],
    ),
    deleteTask: useCallback((taskId: string) => updateBoard((b) => deleteTask(b, taskId)), []),
    addManualSteps: useCallback(
      (taskId: string, inputs: ManualStepInput[]) =>
        updateBoard((b) => addManualSteps(b, taskId, inputs, nowIso())),
      [],
    ),
    updateStep: useCallback(
      (taskId: string, stepId: string, input: ManualStepInput) =>
        updateBoard((b) => updateStep(b, taskId, stepId, input, nowIso())),
      [],
    ),
    toggleStep: useCallback(
      (taskId: string, stepId: string) => updateBoard((b) => toggleStep(b, taskId, stepId, nowIso())),
      [],
    ),
    deleteStep: useCallback(
      (taskId: string, stepId: string) => updateBoard((b) => deleteStep(b, taskId, stepId, nowIso())),
      [],
    ),
    applyProposal: useCallback(
      (taskId: string, inputs: ProposalStepInput[], mode: "append" | "replace") =>
        updateBoard((b) => applyProposal(b, taskId, inputs, mode, nowIso())),
      [],
    ),
  };

  return {
    ready,
    today,
    board: state.board,
    views,
    loadStatus: state.loadStatus,
    saveFailed: state.saveFailed,
    actions,
  };
}

export type BoardActions = ReturnType<typeof useBoard>["actions"];
