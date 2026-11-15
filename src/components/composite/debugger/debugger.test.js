// Debugger: the session (recording, stops, stepping, watches, logpoints, exceptions) and the panel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";

const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Debugger, createDebugSession } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 40)); };

// a program written with the instrumenter's calls (instrument.js): total(items) loops and sums
const META = { file: "cart.js", module: ["total", "cart"], fns: [["total", 1]], steps: [
  [8, 1, -1, "", [], []], [2, 3, 0, "", ["sum", "items"], []], [4, 5, 0, "", ["it", "sum", "items"], []], [6, 3, 0, "", ["sum", "items"], []], [9, 1, -1, "debugger", [], []],
] };
function run(fail = false) {
  const d = globalThis.__marchDebug;
  function total(items) {
    const f = d.e(0, 0);
    try {
      d.s(0, 1, () => [() => sum, () => items, () => total, () => cart]); let sum = 0;
      for (const it of items) { d.s(0, 2, () => [() => it, () => sum, () => items, () => total, () => cart]); sum += it; if (fail && sum > 2) throw new Error("boom"); }
      d.s(0, 3, () => [() => sum, () => items, () => total, () => cart]); return sum;
    } catch (e) { throw d.t(e, f); } finally { d.x(f); }
  }
  d.s(0, 0, () => [() => total, () => cart]); const cart = [1, 2, 3];
  try { total(cart); } catch { /* the error is the test's */ }
  d.s(0, 4, () => [() => total, () => cart]);
}
// a plain evaluator for the tests: the names of the scope as parameters
const evaluate = async (expr, scope) => {
  const names = Object.keys(scope);
  const f = { sum: (s) => s.sum, "sum * 2": (s) => s.sum * 2, "it === 2": (s) => s.it === 2, it: (s) => s.it }[expr];
  if (!f) throw new Error(`unknown ${expr} (${names.join(",")})`);
  return f(scope);
};

test("session: a breakpoint stops in the loop; Continue goes to the next round, then the debugger statement", async () => {
  const s = createDebugSession({ evaluate });
  s.setBreakpoint("cart.js", 4);
  s.begin([META]);
  run();
  await settle();
  assert.equal(s.state(), "paused");
  assert.equal(s.reason(), "breakpoint");
  assert.equal(s.current().line, 4);
  assert.equal(s.current().scopes[0].values.it, 1);
  assert.deepEqual(s.current().stack.map((f) => f.fn), ["total", "(module)"]);
  s.resume(); await settle();
  assert.equal(s.current().scopes[0].values.it, 2, "the next round");
  s.removeBreakpoint(s.breakpoints()[0].id);
  s.resume(); await settle();
  assert.equal(s.reason(), "debugger");
  assert.equal(s.current().line, 9);
  s.end();
  assert.equal(s.state(), "idle");
});

test("session: step into / over / out and back follow the depth; a condition chooses the round", async () => {
  const s = createDebugSession({ evaluate });
  s.stopOnEntry.set(true);
  s.begin([META]);
  run();
  await settle();
  assert.equal(s.reason(), "entry");
  assert.equal(s.current().line, 8);
  s.stepOver(); await settle();
  assert.equal(s.current().line, 9, "over the call of total: the next module step");
  s.stepBack(); await settle();
  assert.equal(s.current().line, 6, "back in time: the last step of total");
  s.stepOut(); await settle();
  assert.equal(s.current().line, 9);
  s.goTo(0); s.stepInto(); await settle();
  assert.equal(s.current().line, 2, "into total");
  s.stopOnEntry.set(false);
  s.setBreakpoint("cart.js", 4, { condition: "it === 2" });
  s.begin([META]); run(); await settle();
  assert.equal(s.current().scopes[0].values.it, 2, "the condition skipped it = 1");
  s.end();
});

test("session: watches at every stop, logpoints write to the output, exceptions stop when asked", async () => {
  const s = createDebugSession({ evaluate });
  s.addWatch("sum * 2");
  s.setBreakpoint("cart.js", 6);
  s.setBreakpoint("cart.js", 4, { log: "sum is {sum}" });
  s.begin([META]); run(); await settle();
  assert.equal(s.current().line, 6);
  assert.deepEqual(s.watchValue(s.watches()[0].id), { ok: true, value: 12 });
  assert.deepEqual(s.output().filter((l) => l.level === "logpoint").map((l) => l.text), ["sum is 0", "sum is 1", "sum is 3"]);
  s.clearBreakpoints();
  s.pauseOnExceptions.set(true);
  s.begin([META]); run(true); await settle();
  assert.equal(s.reason(), "exception");
  assert.equal(s.current().error.message, "boom");
  s.end();
});

test("session: a signal is kept with the value it had then; breakpoints and watches are kept in localStorage", async () => {
  const s = createDebugSession({ evaluate, persist: "test.debug" });
  const count = signal(1);
  s.stopOnEntry.set(true);
  s.begin([{ file: "a.js", module: ["count"], fns: [], steps: [[1, 1, -1, "", [], []]] }]);
  globalThis.__marchDebug.s(0, 0, () => [() => count]);
  await settle();
  count.set(5);
  assert.equal(s.current().scopes[0].values.count(), 1, "the value then");
  s.setBreakpoint("a.js", 3); s.addWatch("count()");
  s.end();
  await tick();
  const again = createDebugSession({ evaluate, persist: "test.debug" });
  assert.deepEqual(again.breakpoints().map((b) => b.line), [3]);
  assert.deepEqual(again.watches().map((w) => w.expr), ["count()"]);
});

test("Debugger: the controls follow the state, the sections show the stop; sections, labels and icons are yours", async () => {
  const s = createDebugSession({ evaluate });
  s.setBreakpoint("cart.js", 4);
  s.addWatch("sum");
  let started = 0;
  const sections = signal(["watch", "scope", "stack", "breakpoints", "output"]);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Debugger, { session: s, sections, onStart: () => { started++; s.begin([META]); run(); }, labels: { resume: "Sürdür" } }), el);
  const btn = (k) => el.querySelector(`.m-dbg-btn.is-${k}`);
  assert.ok(btn("resume").disabled, "nothing to continue while idle");
  btn("start").click();
  await settle();
  assert.equal(started, 1);
  assert.ok(!btn("resume").disabled);
  assert.match(btn("resume").getAttribute("aria-label"), /Sürdür/);
  assert.match(el.querySelector(".m-dbg-status").textContent, /cart\.js:4/);
  assert.ok(el.querySelector(".is-scope .m-dbg-name"), "the scope lists names");
  assert.match(el.querySelector(".is-stack").textContent, /total/);
  assert.match(el.querySelector(".is-watch").textContent, /sum/);
  btn("over").click(); await settle();
  assert.equal(s.current().line, 4, "over, inside the loop: the next round");
  const cond = el.querySelector(".m-dbg-cond");
  s.updateBreakpoint(s.breakpoints()[0].id, { condition: "sum > 0" });
  assert.equal(el.querySelector(".m-dbg-cond"), cond, "a row (and the field being typed in) stays while its breakpoint changes");
  sections.set(["stack"]);
  assert.equal(el.querySelector(".is-watch"), null, "a section left out is not drawn");
  btn("stop").click();
  assert.equal(s.state(), "idle");
  dispose();
});
