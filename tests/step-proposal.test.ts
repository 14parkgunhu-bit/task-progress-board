// 실제 StepProposal의 상태·이벤트를 메모리에서 검사한다. DOM·브라우저 저장소·실제 AI는 사용하지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import type { ProposalStepInput } from "../lib/board.ts";
import type { Task } from "../lib/types.ts";

type Node = { type: unknown; props: Record<string, unknown> };
type Saved = { inputs: ProposalStepInput[]; mode: "append" | "replace" };
const projectRequire = createRequire(import.meta.url);

function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (typeof value !== "object" || value === null || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "props" in value) return text((value as Node).props.children);
  return "";
}

function button(tree: unknown, label: string): Node {
  const found = nodes(tree).find(node => node.type === "button" && text(node.props.children) === label);
  assert.ok(found, `버튼을 찾을 수 없습니다: ${label}`);
  return found;
}

async function session(existing = 0) {
  const source = readFileSync(new URL("../components/StepProposal.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const slots: unknown[] = [];
  let cursor = 0;
  let accepted = true;
  const saved: Saved[] = [];
  const confirmations: string[] = [];
  const task: Task = {
    id: "fixture", title: "가상 업무", memo: "", dueDate: "2026-10-20", revision: 1,
    createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z",
    steps: Array.from({ length: existing }, (_, index) => ({
      id: `old-${index}`, title: "기존 가상 할 일", done: false, source: "manual", edited: false,
    })),
  };
  const props = {
    task, today: "2026-10-12", dDay: 8, onEditTask() {},
    actions: {
      applyProposal(taskId: string, inputs: ProposalStepInput[], mode: "append" | "replace") {
        assert.equal(taskId, "fixture");
        saved.push({ inputs: Array.from(inputs, input => ({ ...input })), mode });
      },
    },
  };
  const testModule = { exports: {} as Record<string, unknown> };
  const jsx = (type: unknown, properties: Record<string, unknown>) => ({ type, props: properties });
  runInNewContext(compiled, {
    module: testModule, exports: testModule.exports,
    window: { confirm(message: string) { confirmations.push(message); return accepted; } },
    require(id: string) {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "react") return {
        useState(initial: unknown) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
          return [slots[index], (value: unknown) => {
            slots[index] = typeof value === "function" ? value(slots[index]) : value;
          }];
        },
        useRef(initial: unknown) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = { current: initial };
          return slots[index];
        },
      };
      if (id === "@/lib/client/api.ts") return {
        postJson: async () => ({
          ok: true, data: {
            status: "ok",
            steps: ["가상 자료 확인하기", "가상 일정 정리하기", "가상 결과 점검하기"]
              .map(title => ({ title, dueDate: "2026-10-20" })),
          },
        }),
      };
      if (id.startsWith("@/")) return projectRequire(fileURLToPath(new URL("../" + id.slice(2), import.meta.url)));
      if (id.startsWith(".")) return { __esModule: true, default: () => null };
      return projectRequire(id);
    },
  });
  const render = () => {
    cursor = 0;
    return (testModule.exports.default as (value: typeof props) => unknown)(props);
  };
  const click = (label: string) => (button(render(), label).props.onClick as () => unknown)();
  const change = (index: number, field: "제목" | "권장 완료일", value: string) => {
    const input = nodes(render()).find(node => node.type === "input" && node.props["aria-label"] === `제안 ${index} ${field}`);
    assert.ok(input);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  await click("AI로 단계 나누기");
  return {
    props, saved, confirmations, render, click, change,
    accept(value: boolean) { accepted = value; },
    leaveOne() { change(1, "제목", ""); change(2, "제목", "   "); },
  };
}

test("제안의 빈 제목·공백 제목은 무시하고 나머지 제목·날짜·수정 여부를 저장한다", async () => {
  const s = await session();
  s.change(1, "제목", "   ");
  s.change(1, "권장 완료일", "2026-10-11");
  s.change(2, "제목", "가상 수정한 단계");
  s.change(2, "권장 완료일", "");
  assert.equal(button(s.render(), "저장").props.disabled, false);
  assert.equal(text(s.render()).includes("할 일을 입력해주세요"), false);
  s.click("저장");
  assert.deepEqual(s.saved, [{
    mode: "replace", inputs: [
      { title: "가상 수정한 단계", dueDate: undefined, edited: true },
      { title: "가상 결과 점검하기", dueDate: "2026-10-20", edited: false },
    ],
  }]);
});

test("제안이 모두 빈 제목이면 버튼과 저장 핸들러가 저장을 거절한다", async () => {
  const s = await session();
  s.leaveOne();
  s.change(3, "제목", "\t");
  assert.equal(button(s.render(), "저장").props.disabled, true);
  s.click("저장");
  assert.equal(s.saved.length, 0);
});

test("기존 49개에서 빈 제안 행을 빼고 1개를 뒤에 추가할 수 있다", async () => {
  const s = await session(49);
  s.leaveOne();
  assert.equal(button(s.render(), "저장").props.disabled, false);
  s.click("저장");
  assert.equal(button(s.render(), "뒤에 추가").props.disabled, false);
  s.click("뒤에 추가");
  assert.equal(s.saved[0].mode, "append");
  assert.equal(s.saved[0].inputs.length, 1);
  assert.equal(s.props.task.steps.length, 49);
});

test("기존 50개에서는 뒤에 추가를 거절하고 빈 행을 뺀 바꾸기는 허용한다", async () => {
  const s = await session(50);
  s.leaveOne();
  s.click("저장");
  assert.equal(button(s.render(), "뒤에 추가").props.disabled, true);
  s.click("뒤에 추가");
  assert.equal(s.saved.length, 0);
  assert.equal(button(s.render(), "바꾸기").props.disabled, false);
  s.click("바꾸기");
  assert.equal(s.saved[0].mode, "replace");
  assert.equal(s.saved[0].inputs.length, 1);
});

test("빈 행을 무시해도 바꾸기의 완료 체크 손실 확인과 취소를 유지한다", async () => {
  const s = await session(1);
  s.props.task.steps[0].done = true;
  s.leaveOne();
  s.click("저장");
  s.accept(false);
  s.click("바꾸기");
  assert.equal(s.saved.length, 0);
  assert.equal(s.props.task.steps[0].done, true);
  assert.ok(s.confirmations[0].includes("체크한 할 일 1개"));
  s.accept(true);
  s.click("바꾸기");
  assert.equal(s.confirmations.length, 2);
  assert.equal(s.saved[0].inputs.length, 1);
});

test("빈 행 옆의 채운 제목이 30자를 넘으면 여전히 저장을 거절한다", async () => {
  const s = await session();
  s.leaveOne();
  assert.equal(button(s.render(), "저장").props.disabled, false);
  s.change(3, "제목", "가".repeat(31));
  assert.equal(button(s.render(), "저장").props.disabled, true);
  s.click("저장");
  assert.equal(s.saved.length, 0);
});

for (const dueDate of ["2026-10-11", "2026-10-21"]) {
  test(`채운 행의 날짜 ${dueDate}가 범위 밖이면 빈 행과 관계없이 저장을 거절한다`, async () => {
    const s = await session();
    s.leaveOne();
    assert.equal(button(s.render(), "저장").props.disabled, false);
    s.change(3, "권장 완료일", dueDate);
    assert.equal(button(s.render(), "저장").props.disabled, true);
    s.click("저장");
    assert.equal(s.saved.length, 0);
  });
}

test("빈 행을 뺀 저장 방식 선택 중 마감일이 바뀌면 버튼과 핸들러가 다시 검사한다", async () => {
  const s = await session(1);
  s.leaveOne();
  s.click("저장");
  assert.equal(button(s.render(), "뒤에 추가").props.disabled, false);
  assert.equal(button(s.render(), "바꾸기").props.disabled, false);
  s.props.task = { ...s.props.task, dueDate: "2026-10-19", revision: 2 };
  s.click("제안 보기");
  assert.equal(button(s.render(), "뒤에 추가").props.disabled, true);
  assert.equal(button(s.render(), "바꾸기").props.disabled, true);
  s.click("뒤에 추가");
  s.click("바꾸기");
  assert.equal(s.saved.length, 0);
});