import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Segmented } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Segmented: radios with aria-checked, roving tabindex, arrows select", () => {
  const v = signal("b");
  const { el } = mount(() => h(Segmented, { "bind:value": v, options: ["a", "b", "c"], "aria-label": "Pick" }));
  const group = el.querySelector("[role=radiogroup]");
  const btns = () => el.querySelectorAll("[role=radio]");
  assert.equal(group.getAttribute("aria-label"), "Pick");
  assert.deepEqual(btns().map((b) => b.getAttribute("tabindex")), ["-1", "0", "-1"]);
  btns()[1].focus();
  key(group, "ArrowRight");
  assert.equal(v(), "c");
  assert.equal(btns()[2].getAttribute("aria-checked"), "true");
  btns()[0].click();
  assert.equal(v(), "a");
});

test("Segmented: option icon and title, an icon-only segment is named by its title", () => {
  const { el } = mount(() => h(Segmented, { value: "list", "aria-label": "View", options: [
    { value: "list", label: "List", icon: "≡" }, { value: "grid", label: "", icon: "▦", title: "Grid" }, { value: "map", label: "Map", disabled: true, title: "No places yet" },
  ] }));
  const [list, grid, map] = el.querySelectorAll("[role=radio]");
  assert.equal(list.querySelector(".hm-segment-icon").textContent, "≡");
  assert.match(list.getAttribute("class"), /hm-segment-has-icon/);
  assert.equal(list.getAttribute("title"), null);
  assert.equal(grid.getAttribute("aria-label"), "Grid");
  assert.equal(grid.getAttribute("title"), "Grid");
  assert.equal(map.getAttribute("title"), "No places yet");
  assert.equal(map.getAttribute("aria-label"), null);
  assert.equal(map.disabled, true);
  assert.doesNotMatch(map.getAttribute("class"), /hm-segment-has-icon/);
});

test("Segmented: indicator=\"slide\" adds one decorative thumb that follows the choice; the default has none", async () => {
  const v = signal(null);
  const { el } = mount(() => [h(Segmented, { "bind:value": v, options: ["a", "b"], indicator: "slide" }), h(Segmented, { options: ["a", "b"] })]);
  const [slide, plain] = el.querySelectorAll("[role=radiogroup]");
  assert.match(slide.getAttribute("class"), /hm-segmented-slide/);
  const thumb = slide.querySelector(".hm-segment-thumb");
  assert.equal(thumb.getAttribute("aria-hidden"), "true");
  assert.equal(slide.querySelectorAll("[role=radio]").length, 2);
  assert.equal(plain.querySelector(".hm-segment-thumb"), null);
  await Promise.resolve();
  assert.doesNotMatch(thumb.getAttribute("class"), /is-on/, "nothing chosen: the thumb is hidden");
  slide.querySelectorAll("[role=radio]")[1].click();
  await Promise.resolve();
  assert.equal(v(), "b");
  assert.match(thumb.getAttribute("class"), /is-on/);
});
