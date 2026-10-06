// Design Ref: §3.2 `diffDays`·`formatDDay`, §3.3 — "오늘" 기준 날짜 계산
// 날짜는 "YYYY-MM-DD" 문자열로만 다루고, 시각·시간대는 계산에 넣지 않는다.
// (서버는 UTC, 사용자는 한국 시간이라 Date 객체를 그대로 비교하면 하루가 어긋날 수 있다.)
import type { DateString } from "./types.ts";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD"를 UTC 자정 기준 밀리초로 바꾼다. 형식이 틀리거나 없는 날짜(2월 30일 등)면 null. */
function toUtcMs(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // 2026-02-30처럼 달력에 없는 날짜는 다음 달로 넘어가므로 되돌려 비교해 걸러낸다
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/** 올바른 "YYYY-MM-DD" 날짜인지 확인한다. */
export function isValidDateString(value: unknown): value is DateString {
  return typeof value === "string" && toUtcMs(value) !== null;
}

/** Date를 그 기기의 현지 날짜 "YYYY-MM-DD"로 바꾼다. (브라우저에서는 사용자 기준 날짜) */
export function toDateString(date: Date): DateString {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 오늘 날짜 "YYYY-MM-DD" (기기의 현지 날짜 기준). 테스트할 때는 now를 넘긴다. */
export function todayString(now: Date = new Date()): DateString {
  return toDateString(now);
}

/**
 * 두 날짜 사이의 날 수 = to - from.
 * 예: diffDays("2026-10-06", "2026-10-09") → 3, 같은 날 → 0, 지난 날 → 음수.
 * 형식이 틀린 날짜가 들어오면 오류를 낸다(조용히 틀린 값을 내지 않도록).
 */
export function diffDays(from: DateString, to: DateString): number {
  const fromMs = toUtcMs(from);
  const toMs = toUtcMs(to);
  if (fromMs === null || toMs === null) {
    throw new Error(`잘못된 날짜 형식입니다: ${fromMs === null ? from : to}`);
  }
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/** 마감까지 남은 날 수 = 마감일 - 오늘 (음수면 마감이 지남). TaskView.dDay 계산에 쓴다. */
export function calcDDay(dueDate: DateString, today: DateString): number {
  return diffDays(today, dueDate);
}

/** D-day 표기: 남은 날 "D-3", 당일 "D-day", 지난 날 "D+1" (PRD 5장) */
export function formatDDay(dDay: number): string {
  if (dDay === 0) return "D-day";
  return dDay > 0 ? `D-${dDay}` : `D+${-dDay}`;
}

/** 요약·카드에 쓰는 "MM/DD" 표기 (예: "2026-10-08" → "10/08") */
export function formatMonthDay(date: DateString): string {
  if (!isValidDateString(date)) {
    throw new Error(`잘못된 날짜 형식입니다: ${date}`);
  }
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`;
}
