// Design Ref: §5.3 AccessCodeInput — 브라우저 전용: 접근 코드 보관 (sessionStorage)
// 창(탭)을 닫으면 지워지도록 sessionStorage에 둔다. 저장소를 못 써도 메모리에 두고 계속 동작한다.
const KEY = "task-board:access-code";

let memory: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function read(): string {
  if (!loaded) {
    loaded = true;
    try {
      memory = window.sessionStorage.getItem(KEY);
    } catch {
      memory = null;
    }
  }
  return memory ?? "";
}

export function subscribeAccessCode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 현재 접근 코드 (없으면 빈 문자열) */
export function getAccessCode(): string {
  return read();
}

export function getServerAccessCode(): string {
  return "";
}

/** 접근 코드 저장 (빈 문자열이면 지움) */
export function setAccessCode(code: string): void {
  memory = code.trim() || null;
  loaded = true;
  try {
    if (memory) window.sessionStorage.setItem(KEY, memory);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 써도 이번 창에서는 메모리 값으로 동작한다
  }
  for (const listener of listeners) listener();
}
