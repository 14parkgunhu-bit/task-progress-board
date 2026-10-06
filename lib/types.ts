// Design Ref: §3.1 — 업무 진행판의 데이터 형태. 화면·서버·테스트가 모두 이 형태를 쓴다.
// 날짜는 모두 "YYYY-MM-DD" 문자열(시각·시간대 없음)로 다룬다. (§3.3)

/** 날짜 문자열 "YYYY-MM-DD" */
export type DateString = string;

/** 할 일의 출처 — "ai": AI 제안을 저장한 것, "manual": 사람이 직접 입력한 것 */
export type StepSource = "ai" | "manual";

/** 할 일 하나 */
export type Step = {
  id: string;
  /** 1~30자. AI 제안은 "~하기"로 끝나야 하고, 직접 입력은 권장만 한다. */
  title: string;
  /** 권장 완료일. AI 제안은 필수, 직접 입력은 선택. 오늘~업무 마감일(둘 다 포함) 안이어야 한다. */
  dueDate?: DateString;
  /** 체크(완료) 여부 */
  done: boolean;
  /** 출처 — PRD 3장 "AI 제안을 그대로 쓰는 비율" 측정용 */
  source: StepSource;
  /** AI 제안을 사용자가 고쳤는지 (직접 입력은 항상 false) */
  edited: boolean;
};

/** 업무 하나 */
export type Task = {
  id: string;
  /** 1~50자 */
  title: string;
  /** 마감일 (필수) */
  dueDate: DateString;
  /** 0~1,000자 */
  memo: string;
  /** 최대 50개, 저장된 순서대로 */
  steps: Step[];
  /** 수정 버전 번호 — 업무명·마감일·메모·할 일(체크 포함)이 바뀔 때마다 +1. 늦은 AI 응답 판단에 쓴다. */
  revision: number;
  /** 만든 시각 (ISO 문자열) */
  createdAt: string;
  /** 마지막으로 고친 시각 (ISO 문자열) */
  updatedAt: string;
};

/** 브라우저 저장 형식 버전 — 형태가 바뀌면 올린다 */
export const BOARD_SCHEMA_VERSION = 1;

/** 브라우저에 저장하는 단위 (진행판 전체) */
export type BoardData = {
  schemaVersion: typeof BOARD_SCHEMA_VERSION;
  /** 보드 전체 버전 — 어떤 업무든 바뀌면 +1. 요약이 최신인지 판단할 때 쓴다. */
  revision: number;
  /** 최대 100건, 등록 순서대로 (같은 마감일 정렬 기준) */
  tasks: Task[];
};

/** 업무 상태 — 완료·지연·임박·정상 (판정 순서: done → overdue → dueSoon → normal) */
export type TaskStatus = "done" | "overdue" | "dueSoon" | "normal";

/** 화면·요약에 쓰는 업무 계산 결과 (저장하지 않고 매번 계산한다) */
export type TaskView = {
  task: Task;
  /** 전체 할 일 수 */
  total: number;
  /** 완료한 할 일 수 */
  doneCount: number;
  /** 남은 할 일 수 */
  remaining: number;
  /** 진행률 0~100 정수 (미완료가 있으면 최대 99) */
  progress: number;
  status: TaskStatus;
  /** 마감일 - 오늘 (음수면 마감이 지남) */
  dDay: number;
};
