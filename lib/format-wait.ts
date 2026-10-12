// Design Ref: §6.1 — "다시 시도까지 남은 시간" 표시 (화면 공용 순수 함수)

/** 초를 "30초" / "5분" / "2시간"으로 바꾼다. (올림) */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}분`;
  return `${Math.ceil(seconds / 3600)}시간`;
}
