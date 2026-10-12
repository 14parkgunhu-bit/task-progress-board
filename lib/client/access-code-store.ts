// Design Ref: §5.3 AccessCodeInput — 브라우저 전용: 접근 코드 보관
// - 기본: sessionStorage — 창(탭)을 닫으면 지워진다 (공용 PC 대비)
// - "이 기기에서 기억하기"를 켜면: localStorage — 이 기기·이 브라우저에서 계속 유지된다 (개인 폰·PC용)
// 저장소를 못 써도 메모리에 두고 이번 창에서는 계속 동작한다.
const KEY = "task-board:access-code";

let memory: string | null = null;
let remembered = false;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const session = window.sessionStorage.getItem(KEY);
    if (session) {
      memory = session;
      remembered = false;
      return;
    }
  } catch {
    // sessionStorage를 못 쓰면 localStorage만 확인한다
  }
  try {
    const kept = window.localStorage.getItem(KEY);
    memory = kept;
    remembered = Boolean(kept);
  } catch {
    memory = null;
    remembered = false;
  }
}

export function subscribeAccessCode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 현재 접근 코드 (없으면 빈 문자열) */
export function getAccessCode(): string {
  load();
  return memory ?? "";
}

export function getServerAccessCode(): string {
  return "";
}

/** 이 기기에 기억된 코드인지 (localStorage에 있는지) */
export function getAccessCodeRemembered(): boolean {
  load();
  return remembered;
}

export function getServerAccessCodeRemembered(): boolean {
  return false;
}

function trySet(storage: () => Storage, value: string | null): boolean {
  try {
    if (value) storage().setItem(KEY, value);
    else storage().removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * 접근 코드 저장. 빈 문자열이면 두 저장소 모두에서 지운다.
 * remember = true면 localStorage(계속 유지), false면 sessionStorage(탭을 닫으면 지워짐)에 둔다.
 * 반대쪽 저장소의 값은 지워서 한 곳에만 남게 한다.
 */
export function setAccessCode(code: string, remember = false): void {
  memory = code.trim() || null;
  loaded = true;
  if (!memory) {
    trySet(() => window.sessionStorage, null);
    trySet(() => window.localStorage, null);
    remembered = false;
  } else if (remember) {
    remembered = trySet(() => window.localStorage, memory);
    trySet(() => window.sessionStorage, remembered ? null : memory);
  } else {
    trySet(() => window.sessionStorage, memory);
    trySet(() => window.localStorage, null);
    remembered = false;
  }
  for (const listener of listeners) listener();
}
