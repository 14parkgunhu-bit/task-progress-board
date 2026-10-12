// Design Ref: §6.1 — 남은 시간 표시 점검
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatWait } from "../lib/format-wait.ts";

test("초·분·시간으로 올림해 표시한다", () => {
  assert.equal(formatWait(42), "42초");
  assert.equal(formatWait(60), "1분");
  assert.equal(formatWait(61), "2분");
  assert.equal(formatWait(600), "10분");
  assert.equal(formatWait(3600), "1시간");
  assert.equal(formatWait(3601), "2시간");
});
