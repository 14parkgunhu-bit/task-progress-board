// 접근 코드 보관: 기본은 탭을 닫으면 지워지고(sessionStorage), "이 기기에서 기억하기"면 계속 유지(localStorage)
// 가상 브라우저 저장소로만 점검한다. 새로 연 탭은 모듈을 새로 불러오는 것으로 흉내 낸다.
import assert from "node:assert/strict";
import { after, test } from "node:test";

type Fake = Map<string, string>;
const makeStorage = (map: Fake) => ({
  getItem: (key: string) => map.get(key) ?? null,
  setItem: (key: string, value: string) => void map.set(key, value),
  removeItem: (key: string) => void map.delete(key),
});
const local: Fake = new Map();
let session: Fake = new Map();
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const fakeWindow = { localStorage: makeStorage(local), sessionStorage: makeStorage(session) };
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
after(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

const KEY = "task-board:access-code";
let tab = 0;
/** 새 탭(또는 브라우저를 닫았다 다시 연 상태)을 흉내 낸다 */
async function openTab(closeBrowser: boolean) {
  if (closeBrowser) {
    session = new Map();
    fakeWindow.sessionStorage = makeStorage(session);
  }
  tab += 1;
  return import(`../lib/client/access-code-store.ts?tab=${tab}`);
}

test("기본(기억 안 함): 탭에서는 유지되고 브라우저를 닫으면 지워진다", async () => {
  const store = await openTab(true);
  store.setAccessCode("  가상코드ABC123  ");
  assert.equal(store.getAccessCode(), "가상코드ABC123");
  assert.equal(store.getAccessCodeRemembered(), false);
  assert.equal(session.get(KEY), "가상코드ABC123");
  assert.equal(local.has(KEY), false);
  const reopened = await openTab(true);
  assert.equal(reopened.getAccessCode(), "");
});

test("이 기기에서 기억하기: 브라우저를 닫았다 다시 열어도 유지된다", async () => {
  const store = await openTab(true);
  store.setAccessCode("가상코드XYZ789", true);
  assert.equal(store.getAccessCodeRemembered(), true);
  assert.equal(local.get(KEY), "가상코드XYZ789");
  assert.equal(session.has(KEY), false); // 한 곳에만 남긴다
  const reopened = await openTab(true);
  assert.equal(reopened.getAccessCode(), "가상코드XYZ789");
  assert.equal(reopened.getAccessCodeRemembered(), true);
});

test("기억을 끄고 저장하면 기기에 남은 값은 지워진다", async () => {
  const store = await openTab(true);
  assert.equal(store.getAccessCodeRemembered(), true);
  store.setAccessCode("가상코드XYZ789", false);
  assert.equal(local.has(KEY), false);
  assert.equal(session.get(KEY), "가상코드XYZ789");
  assert.equal((await openTab(true)).getAccessCode(), "");
});

test("지우기는 두 저장소 모두에서 지운다", async () => {
  const store = await openTab(true);
  store.setAccessCode("가상코드DEL000", true);
  store.setAccessCode("");
  assert.equal(local.has(KEY), false);
  assert.equal(session.has(KEY), false);
  assert.equal(store.getAccessCode(), "");
  assert.equal(store.getAccessCodeRemembered(), false);
});

test("저장소를 못 써도 이번 탭에서는 메모리 값으로 동작한다", async () => {
  const broken = { getItem: () => { throw new Error("막힘"); }, setItem: () => { throw new Error("막힘"); }, removeItem: () => { throw new Error("막힘"); } };
  const saved = { local: fakeWindow.localStorage, session: fakeWindow.sessionStorage };
  fakeWindow.localStorage = broken as never;
  fakeWindow.sessionStorage = broken as never;
  tab += 1;
  const store = await import(`../lib/client/access-code-store.ts?tab=${tab}`);
  store.setAccessCode("가상코드MEM111", true);
  assert.equal(store.getAccessCode(), "가상코드MEM111");
  assert.equal(store.getAccessCodeRemembered(), false); // 실제로 기억되지 않았으면 기억됨으로 표시하지 않는다
  fakeWindow.localStorage = saved.local;
  fakeWindow.sessionStorage = saved.session;
});
