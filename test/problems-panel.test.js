import { test } from "node:test";
import assert from "node:assert/strict";
const { lineColOf, problemsText } = await import("../examples/showcase/src/playground/problems-panel.tsx");

test("problems panel: line and column of an offset; the copied text", () => {
  assert.deepEqual(lineColOf("ab\ncd\nef", 0), { line: 1, col: 1 });
  assert.deepEqual(lineColOf("ab\ncd\nef", 4), { line: 2, col: 2 });
  assert.deepEqual(lineColOf("ab\ncd\nef", 6), { line: 3, col: 1 });
  const p = [{ file: "A.tsx", from: 0, to: 1, line: 22, col: 6, message: "x", error: true, code: 17008 }, { file: "A.tsx", from: 0, to: 1, line: 3, col: 1, message: "y", error: false }];
  assert.equal(problemsText(p), "A.tsx:22:6  hata TS17008  x\nA.tsx:3:1  uyarı  y");
});
