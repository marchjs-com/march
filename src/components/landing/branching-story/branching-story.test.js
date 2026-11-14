import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { BranchingStory, storyEndings } = await import("./index.ts");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const settle = async () => { for (let i = 0; i < 40; i++) step(16); await new Promise((r) => setTimeout(r, 0)); };

const P = {
  a: { title: "A", body: "start", choices: [{ label: "to B", to: "b" }, { label: "to C", to: "c" }] },
  b: { title: "B", body: "middle", choices: [{ label: "to D", to: "d" }] },
  c: { title: "C", body: "end c", ending: "Short" },
  d: { title: "D", body: "end d", ending: "Long" },
};
const title = (el) => { const xs = [...el.querySelectorAll(".hm-bs-passage")].filter((x) => !x.classList.contains("is-leaving")); return xs[xs.length - 1].querySelector(".hm-bs-title").textContent; };

test("storyEndings: every reachable passage without choices", () => {
  assert.deepEqual(storyEndings(P, "a"), ["c", "d"]);
});

test("BranchingStory: choose, trail rewinds, endings counted, keys pick", async () => {
  manualClock(true);
  const seen = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(BranchingStory, { passages: P, start: "a", onChange: (p) => seen.push(p.join(">")) }), el);
  assert.equal(title(el), "A");
  assert.match(el.querySelector(".hm-bs-found").textContent, /0 \/ 2/);
  const choices = () => [...el.querySelectorAll(".hm-bs-choice")].filter((b) => !b.closest(".is-leaving"));
  choices()[0].click();
  await settle();
  assert.equal(title(el), "B");
  assert.equal(el.querySelector("[aria-current=step]").textContent, "to B");
  el.querySelector("section").dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "1", bubbles: true }));
  await settle();
  assert.equal(title(el), "D");
  assert.match(el.querySelector(".hm-bs-found").textContent, /1 \/ 2/);
  assert.match(el.querySelector(".hm-bs-end").textContent, /Start again/);
  el.querySelector(".hm-bs-steps button").click();
  assert.equal(title(el), "A", "the first trail step rewinds to the start");
  assert.deepEqual(seen, ["a>b", "a>b>d", "a"]);
  dispose();
  manualClock(false);
});

test("BranchingStory: own texts, no keys, own choice content, no restart", async () => {
  manualClock(true);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(BranchingStory, {
    passages: { ...P, c: { body: "end c" } }, start: "a", keys: false, restart: false, transition: "none",
    labels: { path: "Trail", start: "Home", end: "Fin", endings: (n, total) => `${n}|${total}` },
    renderChoice: (c, i) => h("b", { class: "own" }, `${i}:${c.to}`),
  }), el);
  assert.equal(el.querySelector(".hm-bs-trail").getAttribute("aria-label"), "Trail");
  assert.equal(el.querySelector("[aria-current=step]").textContent, "Home");
  assert.equal(el.querySelector(".hm-bs-found").textContent, "0|2");
  assert.equal(el.querySelector(".hm-bs-key"), null);
  assert.deepEqual([...el.querySelectorAll(".hm-bs-choice .own")].map((x) => x.textContent), ["0:b", "1:c"]);
  el.querySelector("section").dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "1", bubbles: true }));
  await settle();
  assert.equal(title(el), "A", "number keys are off");
  el.querySelectorAll(".hm-bs-choice")[1].click();
  assert.equal(title(el), "Fin", "transition none: the passage changes at once");
  assert.equal(el.querySelectorAll(".hm-bs-passage").length, 1);
  assert.equal(el.querySelector(".hm-bs-end"), null, "no restart button, no action: no end row");
  assert.equal(el.querySelector(".hm-bs-found").textContent, "1|2");
  dispose();
  manualClock(false);
});

test("BranchingStory: ready-made and own transitions, restart text", async () => {
  manualClock(true);
  const sides = [];
  for (const transition of ["slide", "fade", (side) => { sides.push(side); return { leave: { opacity: [1, 0] }, enter: { opacity: [0, 1] }, duration: 100 }; }]) {
    const el = document.createElement("div"); document.body.appendChild(el);
    const dispose = render(() => h(BranchingStory, { passages: P, start: "a", transition, labels: { restart: "Again", endingPrefix: "End: " } }), el);
    el.querySelectorAll(".hm-bs-choice")[1].click();
    await settle(); await settle();
    assert.equal(title(el), "C");
    assert.equal(el.querySelectorAll(".hm-bs-passage").length, 1, "the old passage is gone after the transition");
    assert.equal(el.querySelector(".hm-bs-restart").textContent, "Again");
    assert.equal(el.querySelector(".hm-bs-ending").textContent, "End: Short");
    el.querySelector(".hm-bs-restart").click();
    await settle();
    assert.equal(title(el), "A");
    dispose();
  }
  assert.deepEqual(sides, [1, -1], "forward, then back");
  manualClock(false);
});
