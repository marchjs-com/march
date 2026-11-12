import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
const { Gantt } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, o = {}) => el.dispatchEvent(new Event("keydown", { bubbles: true, cancelable: true, key: k, ...o }));
const tasks = () => [
  { id: "a", name: "Design", start: "2026-11-02", end: "2026-11-06", progress: 1 },
  { id: "b", name: "Build", start: "2026-11-09", end: "2026-11-13", progress: 0.4, deps: ["a"] },
  { id: "c", name: "Test", start: "2026-11-16", end: "2026-11-18", deps: ["b"] },
  { id: "m", name: "Launch", start: "2026-11-19", end: "2026-11-19", milestone: true, deps: ["c"] },
];
const bar = (el, id) => el.querySelector(`[data-task="${id}"]`);

test("Gantt: rows, bars sized by days, links, accessible names", () => {
  locale.set("en-GB");
  const m = mount(() => h(Gantt, { tasks: tasks(), scale: "day" }));
  assert.equal(m.el.querySelectorAll(".hm-gantt-name").length, 4);
  assert.equal(bar(m.el, "a").style.getPropertyValue("width"), "200px"); // 5 days × 40 px
  assert.equal(m.el.querySelectorAll(".hm-gantt-link").length, 3);
  assert.match(bar(m.el, "b").getAttribute("aria-label"), /Build, .*40% done, after Design/);
  assert.ok(bar(m.el, "m").className.includes("is-milestone"));
  m.dispose();
});

test("Gantt: Alt+→ moves a task and cascades to its successors; Alt+Shift+→ resizes; ↓ focuses the next task", () => {
  locale.set("en-GB");
  const changes = [];
  const m = mount(() => h(Gantt, { tasks: tasks(), scale: "day", onChange: (t) => changes.push([t.id, t.start, t.end]) }));
  // Build ends on the 13th; resize it by 3 days → Test (16th) must move to start on the 17th, Launch after it
  key(bar(m.el, "b"), "ArrowRight", { altKey: true, shiftKey: true });
  key(bar(m.el, "b"), "ArrowRight", { altKey: true, shiftKey: true });
  key(bar(m.el, "b"), "ArrowRight", { altKey: true, shiftKey: true });
  assert.deepEqual(changes.find((c) => c[0] === "b" && c[2] === "2026-11-16"), ["b", "2026-11-09", "2026-11-16"]);
  assert.deepEqual(changes.filter((c) => c[0] === "c").at(-1), ["c", "2026-11-17", "2026-11-19"]);
  assert.deepEqual(changes.filter((c) => c[0] === "m").at(-1), ["m", "2026-11-20", "2026-11-20"]);
  key(bar(m.el, "a"), "ArrowLeft", { altKey: true });
  assert.deepEqual(changes.at(-1), ["a", "2026-11-01", "2026-11-05"]);
  key(bar(m.el, "a"), "ArrowDown");
  assert.equal(document.activeElement, bar(m.el, "b"));
  m.dispose();
});
