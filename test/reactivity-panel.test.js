import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../compiler/index.js";
const { parseProbeName } = await import("../examples/showcase/src/playground/reactivity-panel.tsx");

test("reactivity: a tool's build names each $ signal with its file and line; the name reads back", () => {
  const out = compile("export function A() {\n  let $count = 0\n  return <b>{$count}</b>\n}", { filename: "A.tsx", sourceMarks: true }).code;
  assert.match(out, /signal\(0, \{ name: "count@A\.tsx:2" \}\)/);
  assert.doesNotMatch(compile("export function A() {\n  let $count = 0\n  return <b>{$count}</b>\n}", { filename: "A.tsx" }).code, /name:/);
  assert.deepEqual(parseProbeName("count@A.tsx:2"), { name: "count", file: "A.tsx", line: 2 });
  assert.deepEqual(parseProbeName("effect"), { name: "effect" });
});
