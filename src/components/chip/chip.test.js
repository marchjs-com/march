import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../index.ts");
const { Chip } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Chip: static, toggle (aria-pressed) and removable", () => {
  const on = signal(false);
  let removed = 0;
  const m = mount(() => [
    h(Chip, { tone: "primary", size: "sm" }, "Static"),
    h(Chip, { selected: on, onClick: () => on.set(!on()) }, "Filter"),
    h(Chip, { onRemove: () => removed++ }, "Tag"),
  ]);
  const [a, b, c] = m.el.querySelectorAll(".hm-chip2");
  assert.ok(a.className.includes("hm-chip2-primary") && a.className.includes("hm-chip2-sm"));
  assert.equal(a.querySelector("button"), null);
  const hit = b.querySelector(".hm-chip2-hit");
  assert.equal(hit.getAttribute("aria-pressed"), "false");
  hit.click();
  assert.equal(hit.getAttribute("aria-pressed"), "true");
  assert.ok(b.className.includes("is-selected"));
  c.querySelector(".hm-chip2-x").click();
  assert.equal(removed, 1);
  assert.equal(c.querySelector(".hm-chip2-x").getAttribute("aria-label"), "Remove");
  m.dispose();
});
