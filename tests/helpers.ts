// 테스트용 가상 데이터 만들기 (실제 이름·연락처 없음)
import type { Step, Task } from "../lib/types.ts";

/** 할 일 total개 중 앞의 done개를 체크한 가상 업무를 만든다. */
export function makeTask(
  id: string,
  dueDate: string,
  done: number,
  total: number,
  title: string = id,
): Task {
  const steps: Step[] = Array.from({ length: total }, (_, i) => ({
    id: `${id}-${i}`,
    title: `${i + 1}단계 처리하기`,
    done: i < done,
    source: "manual",
    edited: false,
  }));
  return {
    id,
    title,
    dueDate,
    memo: "",
    steps,
    revision: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}
