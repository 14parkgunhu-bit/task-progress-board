// Design Ref: §3.2 "상한 상수" · §10 — 규칙 숫자는 이 파일 한 곳에만 둔다.
// 화면·서버·테스트가 모두 이 값을 가져다 쓰므로, 숫자를 바꿀 때는 PRD를 먼저 고친다.

// ── 개수 상한 (PRD 5장 공통 정의) ──
/** 진행판에 둘 수 있는 업무 최대 개수 */
export const MAX_TASKS = 100;
/** 업무 하나에 둘 수 있는 할 일 최대 개수 */
export const MAX_STEPS_PER_TASK = 50;

// ── 입력 길이 (PRD 5장·7장 ④) ──
/** 업무명 최대 글자 수 */
export const MAX_TASK_TITLE_LENGTH = 50;
/** 메모 최대 글자 수 */
export const MAX_MEMO_LENGTH = 1000;
/** 할 일 제목 최대 글자 수 (AI 제안·직접 입력 공통) */
export const MAX_STEP_TITLE_LENGTH = 30;

// ── 진행률·상태 (PRD 5장 공통 정의) ──
/** 미완료 할 일이 남아 있을 때 표시할 수 있는 최대 진행률(%) */
export const MAX_PROGRESS_WHEN_INCOMPLETE = 99;
/** 마감까지 남은 날이 이 값 이하(0~3일)면 '임박' */
export const DUE_SOON_DAYS = 3;

// ── AI 단계 쪼개기 (PRD must 1) ──
/** AI가 제안하는 할 일 최소 개수 */
export const AI_STEPS_MIN = 3;
/** AI가 제안하는 할 일 최대 개수 */
export const AI_STEPS_MAX = 7;
/** AI가 실패했을 때 처음 보여줄 직접 입력칸 개수 */
export const MANUAL_STEP_INITIAL_INPUTS = 3;

// ── AI 진행 요약 (PRD must 2) ──
/** 요약 최대 줄 수 */
export const SUMMARY_MAX_LINES = 5;
/** 요약 한 줄 최대 글자 수 */
export const SUMMARY_MAX_LINE_LENGTH = 60;
/** 요약에 업무 줄로 쓰는 미완료 업무 최대 개수 */
export const SUMMARY_MAX_TASK_LINES = 3;
/** 요약 줄에 쓰는 업무명 최대 글자 수 (넘으면 앞 14자 + "…") */
export const SUMMARY_TITLE_MAX_LENGTH = 15;

// ── AI 호출 (PRD 5장 AI 오류 처리) ──
/** AI 응답 대기 시간 제한(밀리초) */
export const AI_TIMEOUT_MS = 15_000;
/** AI 최대 시도 횟수 (처음 1번 + 자동 재시도 1번) */
export const AI_MAX_ATTEMPTS = 2;

// ── 남용 방지 (PRD 7장 ④) ──
/** 접속자 한 명이 1분 동안 부를 수 있는 AI 요청 수 */
export const RATE_LIMIT_PER_MINUTE = 5;
/** 접속자 한 명이 최근 24시간 동안 부를 수 있는 AI 요청 수 */
export const RATE_LIMIT_PER_DAY = 50;
/** 틀린 접근 코드를 10분 동안 시도할 수 있는 횟수 (무작위 대입 방지, 보안 점검 SEC-001) */
export const ACCESS_CODE_FAILURES_PER_10_MIN = 10;
/** AI 응답 최대 길이(토큰) — 프롬프트 주입으로 긴 출력을 유도해 비용을 늘리지 못하게 (보안 점검 SEC-004) */
export const AI_MAX_COMPLETION_TOKENS = 800;
