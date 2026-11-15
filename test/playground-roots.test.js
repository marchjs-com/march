// Playground: the elements a file writes at its top level (assigned to nothing) are components of their own.
import { test } from "node:test";
import assert from "node:assert/strict";
const { findRoots, exportRoots } = await import("../examples/showcase/src/playground/roots.ts");

const SRC = `import { Debugger, CodeEditor, createDebugSession } from "hadi-march/ui";

const session = createDebugSession({ persist: "my-ide.debug" });   // a comment with <Tag> in it

const $code = "";
const kept = <Badge>value</Badge>
const f = () => {
  return <Card />
}

<CodeEditor lineNumbers bind:value={$code}
  lineMarks={() => session.breakpoints().map((b) => ({ line: b.line, kind: b.condition ? "conditional" : "breakpoint" }))}
  activeLine={() => session.litLine("app.ts")} onGutter={(line) => session.toggleBreakpoint("app.ts", line)} />

<Debugger session={session} onStart={async () => { const r = await ts.instrument(files); session.begin(r.metas); run(r.files) }}
  onReveal={(file, line) => openAt(file, line)} />

<p class="note">a <b>bold</b> {"{text}"} line</p>
<CodeEditor />
`;

test("findRoots: top-level elements only (not a value, not inside a function), named by their tag", () => {
  const roots = findRoots(SRC);
  assert.deepEqual(roots.map((r) => [r.name, r.tag]), [["CodeEditor_1", "CodeEditor"], ["Debugger_1", "Debugger"], ["P_1", "<p>"], ["CodeEditor_2", "CodeEditor"]]);
  assert.ok(SRC.slice(roots[0].from, roots[0].to).endsWith(`onGutter={(line) => session.toggleBreakpoint("app.ts", line)} />`));
  assert.ok(SRC.slice(roots[2].from, roots[2].to).endsWith("</p>"));
});

test("exportRoots: each root becomes an exported component whose props go over the written ones", () => {
  const out = exportRoots(SRC);
  assert.match(out, /export const Debugger_1 = \(__p: any\) => \(<Debugger session=\{session\}[\s\S]*onReveal=\{\(file, line\) => openAt\(file, line\)\}  \{\.\.\.__p\}\/>\);/);
  assert.match(out, /export const P_1 = \(__p: any\) => \(<p class="note" \{\.\.\.__p\}>a <b>bold<\/b>/);
  assert.match(out, /const kept = <Badge>value<\/Badge>/, "an assigned element stays as it is");
  assert.equal(findRoots("const a = 1\n").length, 0);
});

test("viewRoots: the inserts map positions both ways (a typed props parameter for TypeScript)", async () => {
  const { viewRoots, toView, toOriginal } = await import("../examples/showcase/src/playground/roots.ts");
  const src = "const a = 1\n<A x={a} />\n<B />\n";
  const v = viewRoots(src);
  assert.match(v.text, /export const A_1 = \(__p: any\) => \(<A x=\{a\}  \{\.\.\.__p\}\/>\);/);
  assert.equal(viewRoots(src, false).text.includes("__p: any"), false);
  for (const pos of [0, 5, src.indexOf("x="), src.indexOf("<B"), src.length]) assert.equal(toOriginal(v.inserts, toView(v.inserts, pos)), pos, `round trip at ${pos}`);
  assert.equal(v.text.slice(toView(v.inserts, src.indexOf("x=")), toView(v.inserts, src.indexOf("x=")) + 5), "x={a}");
});
